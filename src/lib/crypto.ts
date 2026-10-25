import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable is not set.");
  }
  // Master key can be a 64-char hex string (32 bytes) or derived
  if (masterKey.length === 64) {
    return Buffer.from(masterKey, "hex");
  }
  return crypto.createHash("sha256").update(masterKey).digest();
}

export interface EncryptedPayload {
  encryptedData: string; // Hex string (ciphertext + authTag)
  iv: string; // Hex string
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export function encryptData(plainText: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();
  // Pack ciphertext + authTag together
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    encryptedData: combined.toString("hex"),
    iv: iv.toString("hex"),
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export function decryptData(encryptedPayload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedPayload.iv, "hex");
  const combined = Buffer.from(encryptedPayload.encryptedData, "hex");

  if (combined.length < AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data length.");
  }

  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
