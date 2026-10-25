import { describe, it, expect, beforeAll } from "vitest";
import { encryptData, decryptData } from "@/lib/crypto";

describe("AES-256-GCM Native Encryption Module", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });
  it("should encrypt plaintext into ciphertext and 96-bit IV", () => {
    const secret = "mock_enterprise_super_secret_token_123456789";
    const encrypted = encryptData(secret);

    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    // 12 bytes = 24 hex characters
    expect(encrypted.iv.length).toBe(24);
    expect(encrypted.encryptedData).not.toBe(secret);
  });

  it("should decrypt ciphertext back to original plaintext", () => {
    const secret = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EnterpriseToken";
    const encrypted = encryptData(secret);
    const decrypted = decryptData(encrypted);

    expect(decrypted).toBe(secret);
  });

  it("should generate unique IV for every encryption call", () => {
    const secret = "constant_secret_value";
    const enc1 = encryptData(secret);
    const enc2 = encryptData(secret);

    // IV must never be reused in AES-GCM
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encryptedData).not.toBe(enc2.encryptedData);

    // Both should decrypt to same original value
    expect(decryptData(enc1)).toBe(secret);
    expect(decryptData(enc2)).toBe(secret);
  });

  it("should reject tampered ciphertext with authentication tag failure", () => {
    const secret = "confidential_financial_data";
    const encrypted = encryptData(secret);

    // Tamper with one character of the ciphertext
    const tamperedData =
      encrypted.encryptedData.slice(0, 10) +
      (encrypted.encryptedData[10] === "a" ? "b" : "a") +
      encrypted.encryptedData.slice(11);

    expect(() =>
      decryptData({
        encryptedData: tamperedData,
        iv: encrypted.iv,
      })
    ).toThrow();
  });
});
