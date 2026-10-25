"use server";

import {
  createCredential,
  listCredentials,
  deleteCredential,
  SafeCredentialRecord,
} from "@/lib/services/credential-service";

export async function createCredentialAction(input: {
  name: string;
  type: string;
  value: string;
}): Promise<{
  success: boolean;
  credential?: SafeCredentialRecord;
  error?: string;
}> {
  try {
    if (!input.name.trim() || !input.value.trim()) {
      return { success: false, error: "Name and credential value are required." };
    }

    const created = await createCredential({
      name: input.name,
      type: input.type,
      value: input.value,
    });

    return { success: true, credential: created };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to encrypt and store credential.",
    };
  }
}

export async function listCredentialsAction(): Promise<SafeCredentialRecord[]> {
  return await listCredentials();
}

export async function deleteCredentialAction(id: string): Promise<{ success: boolean }> {
  const ok = await deleteCredential(id);
  return { success: ok };
}
