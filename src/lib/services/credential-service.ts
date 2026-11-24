import { prisma } from "@/lib/prisma";
import { encryptData, decryptData, isEncryptionConfigured } from "@/lib/crypto";
import { tryDb } from "@/lib/db/circuit";
import { DEMO_ACCOUNTS, DEMO_WORKSPACE } from "@/lib/auth/demo";
import { isDemoMode } from "@/lib/config/env";
import { newId } from "@/lib/store/memory-store";
import { logger } from "@/lib/logger";

export interface SafeCredentialRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  type: string;
  maskedValue: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCredentialRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  type: string;
  encryptedData: string;
  iv: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CREDENTIAL_TYPES = ["api_key", "bearer_token", "oauth_secret", "webhook_secret", "basic_auth", "hmac_secret", "other"] as const;
const NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_SECRET_LENGTH = 8192;

const globalForCreds = globalThis as unknown as { __nfCredentials?: Map<string, StoredCredentialRecord>; __nfCredSeeded?: boolean };
const memoryCredentials: Map<string, StoredCredentialRecord> =
  globalForCreds.__nfCredentials ?? (globalForCreds.__nfCredentials = new Map());

/** @deprecated kept for compatibility; availability is handled by the DB circuit breaker. */
export function setCredentialDbAvailability(): void {}

export function normalizeCredentialName(name: string): string {
  return name.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}

function safeMask(record: { encryptedData: string; iv: string }): string {
  try {
    return maskSecret(decryptData(record));
  } catch {
    return "••••••••";
  }
}

function toSafe(r: StoredCredentialRecord): SafeCredentialRecord {
  return {
    id: r.id,
    userId: r.userId,
    workspaceId: r.workspaceId,
    name: r.name,
    type: r.type,
    maskedValue: safeMask(r),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Sample vault entries for the demo workspace (memory only, created lazily). */
function seedDemoCredentials(): void {
  if (globalForCreds.__nfCredSeeded || !isDemoMode() || !isEncryptionConfigured()) return;
  globalForCreds.__nfCredSeeded = true;
  const owner = DEMO_ACCOUNTS["admin@enterprise.io"].id;
  const samples = [
    { id: "cred_stripe_prod", name: "STRIPE_PRODUCTION_API_KEY", type: "bearer_token", value: "mock_stripe_live_corp_vault_token_sample" },
    { id: "cred_openai_key", name: "OPENAI_ORGANIZATION_KEY", type: "api_key", value: "mock_openai_vault_api_key_sample" },
    { id: "cred_internal_auth", name: "INTERNAL_LEDGER_AUTH_SECRET", type: "bearer_token", value: "Bearer token_corp_secret_authenticated_ledger" },
  ];
  for (const s of samples) {
    const enc = encryptData(s.value);
    memoryCredentials.set(s.id, {
      id: s.id,
      userId: owner,
      workspaceId: DEMO_WORKSPACE.id,
      name: s.name,
      type: s.type,
      encryptedData: enc.encryptedData,
      iv: enc.iv,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

function memoryList(workspaceId: string): StoredCredentialRecord[] {
  seedDemoCredentials();
  return Array.from(memoryCredentials.values()).filter((c) => c.workspaceId === workspaceId);
}

export async function listCredentials(workspaceId: string): Promise<SafeCredentialRecord[]> {
  const res = await tryDb(() => prisma.credential.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }));
  const rows: StoredCredentialRecord[] = res.ok
    ? res.value.map((r) => ({ ...r, workspaceId: r.workspaceId }))
    : memoryList(workspaceId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // The demo vault ships with sample secrets even before anything is stored in PostgreSQL.
  if (res.ok && rows.length === 0 && workspaceId === DEMO_WORKSPACE.id) {
    return memoryList(workspaceId).map(toSafe);
  }
  return rows.map(toSafe);
}

function validateInput(name: string, value: string): string | null {
  if (!NAME_PATTERN.test(name)) {
    return "Name must start with a letter and contain only A–Z, 0–9 and '_' (2–64 characters).";
  }
  if (!value.trim()) return "Credential value is required.";
  if (value.length > MAX_SECRET_LENGTH) return `Credential value must be at most ${MAX_SECRET_LENGTH} characters.`;
  return null;
}

export async function createCredential(input: {
  workspaceId: string;
  userId: string;
  name: string;
  type: string;
  value: string;
}): Promise<{ success: true; credential: SafeCredentialRecord } | { success: false; error: string }> {
  const name = normalizeCredentialName(input.name);
  const invalid = validateInput(name, input.value);
  if (invalid) return { success: false, error: invalid };
  const type = (CREDENTIAL_TYPES as readonly string[]).includes(input.type) ? input.type : "other";

  const existing = await findStored(input.workspaceId, name);
  if (existing) return { success: false, error: `A credential named ${name} already exists. Rotate it instead.` };

  const encrypted = encryptData(input.value);
  const now = new Date();
  const stored: StoredCredentialRecord = {
    id: newId("cred"),
    userId: input.userId,
    workspaceId: input.workspaceId,
    name,
    type,
    encryptedData: encrypted.encryptedData,
    iv: encrypted.iv,
    createdAt: now,
    updatedAt: now,
  };

  const res = await tryDb(() =>
    prisma.credential.create({
      data: {
        id: stored.id,
        userId: stored.userId,
        workspaceId: stored.workspaceId,
        name: stored.name,
        type: stored.type,
        encryptedData: stored.encryptedData,
        iv: stored.iv,
      },
    })
  );
  if (!res.ok) memoryCredentials.set(stored.id, stored);
  return { success: true, credential: { ...toSafe(stored), maskedValue: maskSecret(input.value) } };
}

export async function rotateCredential(
  id: string,
  workspaceId: string,
  value: string
): Promise<{ success: true; credential: SafeCredentialRecord } | { success: false; error: string }> {
  const existing = await findStoredById(id, workspaceId);
  if (!existing) return { success: false, error: "Credential not found." };
  const invalid = validateInput(existing.name, value);
  if (invalid) return { success: false, error: invalid };

  const encrypted = encryptData(value);
  const updated: StoredCredentialRecord = { ...existing, encryptedData: encrypted.encryptedData, iv: encrypted.iv, updatedAt: new Date() };

  const res = await tryDb(async () => {
    const found = await prisma.credential.findFirst({ where: { id, workspaceId } });
    if (!found) return false;
    await prisma.credential.update({ where: { id }, data: { encryptedData: updated.encryptedData, iv: updated.iv } });
    return true;
  });
  if (!res.ok || !res.value) memoryCredentials.set(id, updated);
  return { success: true, credential: { ...toSafe(updated), maskedValue: maskSecret(value) } };
}

export async function deleteCredential(id: string, workspaceId: string): Promise<boolean> {
  const res = await tryDb(() => prisma.credential.deleteMany({ where: { id, workspaceId } }));
  const mem = memoryCredentials.get(id);
  let deletedFromMemory = false;
  if (mem && mem.workspaceId === workspaceId) deletedFromMemory = memoryCredentials.delete(id);
  return (res.ok && res.value.count > 0) || deletedFromMemory;
}

async function findStoredById(id: string, workspaceId: string): Promise<StoredCredentialRecord | null> {
  const res = await tryDb(() => prisma.credential.findFirst({ where: { id, workspaceId } }));
  if (res.ok && res.value) return res.value;
  const mem = memoryCredentials.get(id);
  return mem && mem.workspaceId === workspaceId ? mem : null;
}

async function findStored(workspaceId: string, name: string): Promise<StoredCredentialRecord | null> {
  const res = await tryDb(() => prisma.credential.findFirst({ where: { workspaceId, name } }));
  if (res.ok && res.value) return res.value;
  return memoryList(workspaceId).find((c) => c.name === name) ?? null;
}

/** Decrypted secret of one workspace credential, by name. */
export async function getCredentialSecret(workspaceId: string, nameOrId: string): Promise<string | null> {
  const normalized = normalizeCredentialName(nameOrId);
  const found = (await findStored(workspaceId, normalized)) ?? (await findStoredById(nameOrId.trim(), workspaceId));
  if (!found) return null;
  try {
    return decryptData(found);
  } catch (err) {
    logger.error("Credential decryption failed (wrong ENCRYPTION_MASTER_KEY?)", { credential: found.name, err });
    return null;
  }
}

/** Decrypts only the credentials a workflow actually references. */
export async function getCredentialSecrets(workspaceId: string, names: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of new Set(names)) {
    const secret = await getCredentialSecret(workspaceId, name);
    if (secret !== null) out[name] = secret;
  }
  return out;
}

/** Finds `{{credentials.NAME}}` references inside any (nested) config value. */
export function extractCredentialReferences(value: unknown): string[] {
  const refs = new Set<string>();
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/\{\{\s*credentials\.([A-Za-z0-9_]+)\s*\}\}/g)) refs.add(m[1]);
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(visit);
    }
  };
  visit(value);
  return Array.from(refs);
}
