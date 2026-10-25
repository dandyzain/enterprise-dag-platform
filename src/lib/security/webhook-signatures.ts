import crypto from "node:crypto";

/**
 * Enterprise Webhook Cryptographic Signature Verification
 * Prevents forged payloads and protects against replay attacks.
 */

export interface SignatureVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verifies Stripe-style webhook signatures:
 * Format: t=1729580000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
 */
export function verifyStripeSignature(
  rawPayload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): SignatureVerificationResult {
  try {
    const items = signatureHeader.split(",");
    let timestamp: number | null = null;
    const signatures: string[] = [];

    for (const item of items) {
      const [key, value] = item.split("=");
      if (key === "t") {
        timestamp = parseInt(value, 10);
      } else if (key === "v1") {
        signatures.push(value);
      }
    }

    if (!timestamp || signatures.length === 0) {
      return { isValid: false, error: "Missing timestamp (t) or signature (v1) in Stripe-Signature header." };
    }

    // Anti-replay attack timestamp check
    const currentEpoch = Math.floor(Date.now() / 1000);
    if (Math.abs(currentEpoch - timestamp) > toleranceSeconds) {
      return {
        isValid: false,
        error: `Timestamp drift exceeded tolerance of ${toleranceSeconds}s (Replay attack prevention).`,
      };
    }

    // Compute expected HMAC-SHA256 signature
    const signedPayload = `${timestamp}.${rawPayload}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    // Check if any v1 matches in constant time
    for (const sig of signatures) {
      const sigBuffer = Buffer.from(sig, "utf-8");
      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return { isValid: true };
      }
    }

    return { isValid: false, error: "Signature mismatch: payload authentication failed." };
  } catch (err) {
    return {
      isValid: false,
      error: `Verification error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Verifies GitHub-style webhook signatures:
 * Format: sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f0196b01b0ce85
 */
export function verifyGithubSignature(
  rawPayload: string,
  signatureHeader: string,
  secret: string
): SignatureVerificationResult {
  try {
    if (!signatureHeader.startsWith("sha256=")) {
      return { isValid: false, error: "Header must begin with 'sha256=' prefix." };
    }

    const providedSignature = signatureHeader.substring(7);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const providedBuf = Buffer.from(providedSignature, "utf-8");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");

    if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { isValid: true };
    }

    return { isValid: false, error: "GitHub signature hash mismatch." };
  } catch (err) {
    return { isValid: false, error: "Malformed signature format." };
  }
}

/**
 * Generic HMAC-SHA256 verification
 */
export function verifyGenericHmac(
  rawPayload: string,
  providedSignature: string,
  secret: string
): SignatureVerificationResult {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const providedBuf = Buffer.from(providedSignature, "utf-8");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");

    if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { isValid: true };
    }

    return { isValid: false, error: "HMAC signature mismatch." };
  } catch {
    return { isValid: false, error: "Verification failed." };
  }
}
