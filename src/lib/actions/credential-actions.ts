"use server";

import { revalidatePath } from "next/cache";
import {
  createCredential,
  listCredentials,
  deleteCredential,
  rotateCredential,
  type SafeCredentialRecord,
} from "@/lib/services/credential-service";
import { ensurePrincipalInDb } from "@/lib/services/auth-service";
import { recordAudit } from "@/lib/services/audit-service";
import { guarded, requirePermission, AuthError } from "@/lib/auth/guards";
import { isDbAvailable } from "@/lib/db/circuit";

export async function createCredentialAction(input: {
  name: string;
  type: string;
  value: string;
}): Promise<{ success: boolean; credential?: SafeCredentialRecord; error?: string }> {
  return guarded("credential:create", async (session) => {
    if (!input?.name?.trim() || !input?.value?.trim()) {
      return { success: false, error: "Name and credential value are required." };
    }
    try {
      const userId = isDbAvailable() ? await ensurePrincipalInDb(session) : session.id;
      const res = await createCredential({ workspaceId: session.workspaceId, userId, name: input.name, type: input.type, value: input.value });
      if (!res.success) return res;
      await recordAudit(session, session.workspaceId, "credential.created", { type: "credential", id: res.credential.id }, { name: res.credential.name });
      revalidatePath("/", "layout");
      return { success: true, credential: res.credential };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to encrypt and store credential." };
    }
  });
}

export async function rotateCredentialAction(
  id: string,
  value: string
): Promise<{ success: boolean; credential?: SafeCredentialRecord; error?: string }> {
  return guarded("credential:create", async (session) => {
    try {
      const res = await rotateCredential(id, session.workspaceId, value ?? "");
      if (!res.success) return res;
      await recordAudit(session, session.workspaceId, "credential.rotated", { type: "credential", id }, { name: res.credential.name });
      revalidatePath("/", "layout");
      return { success: true, credential: res.credential };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to rotate credential." };
    }
  });
}

export async function listCredentialsAction(): Promise<SafeCredentialRecord[]> {
  try {
    const session = await requirePermission("credential:view");
    return await listCredentials(session.workspaceId);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
}

export async function deleteCredentialAction(id: string): Promise<{ success: boolean; error?: string }> {
  return guarded("credential:delete", async (session) => {
    const ok = await deleteCredential(id, session.workspaceId);
    if (!ok) return { success: false, error: "Credential not found." };
    await recordAudit(session, session.workspaceId, "credential.deleted", { type: "credential", id });
    revalidatePath("/", "layout");
    return { success: true };
  });
}
