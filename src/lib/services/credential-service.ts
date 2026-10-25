import { prisma } from "@/lib/prisma";
import { encryptData, decryptData, EncryptedPayload } from "@/lib/crypto";

export interface SafeCredentialRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  maskedValue: string;
  createdAt: Date;
}

export interface StoredCredentialRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  encryptedData: string;
  iv: string;
  createdAt: Date;
}

// In-memory fallback credential storage
const memoryCredentials = new Map<string, StoredCredentialRecord>();

let isCredentialDbAvailable = true;

export function setCredentialDbAvailability(available: boolean): void {
  isCredentialDbAvailable = available;
}

export function isCredentialDbAvailableState(): boolean {
  return isCredentialDbAvailable;
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "••••••••";
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

// Pre-populate with initial vault credentials
const seedCreds = [
  {
    id: "cred_stripe_prod",
    userId: "usr_default_admin",
    name: "STRIPE_PRODUCTION_API_KEY",
    type: "bearer_token",
    value: "mock_stripe_live_corp_vault_token_sample",
  },
  {
    id: "cred_openai_key",
    userId: "usr_default_admin",
    name: "OPENAI_ORGANIZATION_KEY",
    type: "api_key",
    value: "mock_openai_vault_api_key_sample",
  },
  {
    id: "cred_internal_auth",
    userId: "usr_default_admin",
    name: "INTERNAL_LEDGER_AUTH_SECRET",
    type: "bearer_token",
    value: "Bearer token_corp_secret_authenticated_ledger",
  },
];

for (const cred of seedCreds) {
  const enc = encryptData(cred.value);
  memoryCredentials.set(cred.id, {
    id: cred.id,
    userId: cred.userId,
    name: cred.name,
    type: cred.type,
    encryptedData: enc.encryptedData,
    iv: enc.iv,
    createdAt: new Date(),
  });
}

export async function createCredential(input: {
  userId?: string;
  name: string;
  type: string;
  value: string;
}): Promise<SafeCredentialRecord> {
  const userId = input.userId || "usr_default_admin";
  const id = `cred_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const encrypted = encryptData(input.value);

  const stored: StoredCredentialRecord = {
    id,
    userId,
    name: input.name.trim().toUpperCase().replace(/\s+/g, "_"),
    type: input.type,
    encryptedData: encrypted.encryptedData,
    iv: encrypted.iv,
    createdAt: new Date(),
  };

  if (isCredentialDbAvailable) {
    try {
      // Ensure user exists
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: "admin@enterprise.io",
          name: "Enterprise Architect",
        },
        update: {},
      });

      const created = await prisma.credential.create({
        data: {
          id: stored.id,
          userId: stored.userId,
          name: stored.name,
          type: stored.type,
          encryptedData: stored.encryptedData,
          iv: stored.iv,
        },
      });
      stored.id = created.id;
      stored.createdAt = created.createdAt;
    } catch {
      isCredentialDbAvailable = false;
    }
  }

  memoryCredentials.set(stored.id, stored);

  return {
    id: stored.id,
    userId: stored.userId,
    name: stored.name,
    type: stored.type,
    maskedValue: maskSecret(input.value),
    createdAt: stored.createdAt,
  };
}

export async function listCredentials(userId = "usr_default_admin"): Promise<SafeCredentialRecord[]> {
  if (isCredentialDbAvailable) {
    try {
      const dbRecords = await prisma.credential.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (dbRecords.length > 0) {
        return dbRecords.map((r) => {
          let masked = "••••••••";
          try {
            const decrypted = decryptData({
              encryptedData: r.encryptedData,
              iv: r.iv,
            });
            masked = maskSecret(decrypted);
          } catch {
            // If decrypt fails, fallback
          }

          return {
            id: r.id,
            userId: r.userId,
            name: r.name,
            type: r.type,
            maskedValue: masked,
            createdAt: r.createdAt,
          };
        });
      }
    } catch {
      isCredentialDbAvailable = false;
    }
  }

  const list: SafeCredentialRecord[] = [];
  for (const stored of memoryCredentials.values()) {
    let masked = "••••••••";
    try {
      const decrypted = decryptData({
        encryptedData: stored.encryptedData,
        iv: stored.iv,
      });
      masked = maskSecret(decrypted);
    } catch {
      //
    }

    list.push({
      id: stored.id,
      userId: stored.userId,
      name: stored.name,
      type: stored.type,
      maskedValue: masked,
      createdAt: stored.createdAt,
    });
  }

  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCredentialSecret(nameOrId: string): Promise<string | null> {
  const normalized = nameOrId.trim();

  if (isCredentialDbAvailable) {
    try {
      const found = await prisma.credential.findFirst({
        where: {
          OR: [{ id: normalized }, { name: normalized.toUpperCase() }],
        },
      });

      if (found) {
        return decryptData({
          encryptedData: found.encryptedData,
          iv: found.iv,
        });
      }
    } catch {
      isCredentialDbAvailable = false;
    }
  }

  // Check memory store by ID
  const byId = memoryCredentials.get(normalized);
  if (byId) {
    return decryptData({
      encryptedData: byId.encryptedData,
      iv: byId.iv,
    });
  }

  // Check memory store by name
  for (const item of memoryCredentials.values()) {
    if (item.name === normalized.toUpperCase() || item.name === normalized) {
      return decryptData({
        encryptedData: item.encryptedData,
        iv: item.iv,
      });
    }
  }

  return null;
}

export async function deleteCredential(id: string): Promise<boolean> {
  try {
    await prisma.credential.delete({
      where: { id },
    });
  } catch {
    //
  }

  const deleted = memoryCredentials.delete(id);
  return deleted;
}
