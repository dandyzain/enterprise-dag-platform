import { describe, it, expect } from "vitest";
import { validateSafeUrl } from "@/lib/security/anti-ssrf";
import {
  verifyStripeSignature,
  verifyGithubSignature,
  verifyGenericHmac,
} from "@/lib/security/webhook-signatures";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import crypto from "node:crypto";

describe("Phase 2 & 3: Production Security, Anti-SSRF & Webhook Protections", () => {
  describe("1. Anti-SSRF Egress Network Guard", () => {
    it("should allow safe public endpoints (HTTPS)", () => {
      expect(validateSafeUrl("https://api.stripe.com/v1/charges").isSafe).toBe(true);
      expect(validateSafeUrl("https://api.github.com/users/octocat").isSafe).toBe(true);
      expect(validateSafeUrl("http://example.com/webhook-sink").isSafe).toBe(true);
    });

    it("should block loopback and local hostnames", () => {
      expect(validateSafeUrl("http://localhost:3000/admin").isSafe).toBe(false);
      expect(validateSafeUrl("http://localhost:5432").isSafe).toBe(false);
      expect(validateSafeUrl("http://127.0.0.1:8080").isSafe).toBe(false);
      expect(validateSafeUrl("http://[::1]:3000").isSafe).toBe(false);
    });

    it("should block cloud provider metadata endpoints (AWS, GCP, Azure)", () => {
      expect(validateSafeUrl("http://169.254.169.254/latest/meta-data/").isSafe).toBe(false);
      expect(validateSafeUrl("http://metadata.google.internal/computeMetadata/v1/").isSafe).toBe(false);
    });

    it("should block private network subnets (Class A, B, C)", () => {
      expect(validateSafeUrl("http://10.0.0.15/internal").isSafe).toBe(false);
      expect(validateSafeUrl("http://192.168.1.1/router").isSafe).toBe(false);
      expect(validateSafeUrl("http://172.16.0.5/api").isSafe).toBe(false);
      expect(validateSafeUrl("http://172.31.255.255/admin").isSafe).toBe(false);
    });

    it("should block forbidden protocols (file://, ftp://, gopher://)", () => {
      expect(validateSafeUrl("file:///etc/passwd").isSafe).toBe(false);
      expect(validateSafeUrl("ftp://files.internal.corp/dump").isSafe).toBe(false);
    });
  });

  describe("2. Cryptographic Webhook Signatures", () => {
    const secret = "whsec_live_test_secret_key_2026";
    const payload = JSON.stringify({ event: "charge.succeeded", id: "ch_9824" });

    it("should verify valid Stripe webhook signature with anti-replay timestamp", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${payload}`)
        .digest("hex");
      const header = `t=${timestamp},v1=${signature}`;

      const res = verifyStripeSignature(payload, header, secret);
      expect(res.isValid).toBe(true);
    });

    it("should reject expired Stripe webhook signature (replay attack protection)", () => {
      // 10 minutes ago (> 300s tolerance)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(`${oldTimestamp}.${payload}`)
        .digest("hex");
      const header = `t=${oldTimestamp},v1=${signature}`;

      const res = verifyStripeSignature(payload, header, secret);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Replay attack");
    });

    it("should reject forged Stripe webhook signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`;

      const res = verifyStripeSignature(payload, header, secret);
      expect(res.isValid).toBe(false);
    });

    it("should verify valid GitHub webhook signature", () => {
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const header = `sha256=${sig}`;

      expect(verifyGithubSignature(payload, header, secret).isValid).toBe(true);
      expect(verifyGithubSignature(payload, "sha256=invalidhash", secret).isValid).toBe(false);
    });

    it("should verify generic HMAC-SHA256 signature", () => {
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      expect(verifyGenericHmac(payload, sig, secret).isValid).toBe(true);
      expect(verifyGenericHmac(payload, "fake", secret).isValid).toBe(false);
    });
  });

  describe("3. Token Bucket Rate Limiter", () => {
    it("should allow requests within limit and throttle when bucket is exhausted", () => {
      const testIp = `test_ip_${Date.now()}`;
      const options = { maxRequests: 5, windowMs: 10_000 };

      // 5 requests allowed
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(testIp, options);
        expect(res.allowed).toBe(true);
      }

      // 6th request throttled
      const throttled = checkRateLimit(testIp, options);
      expect(throttled.allowed).toBe(false);
      expect(throttled.remaining).toBe(0);
      expect(throttled.resetMs).toBeGreaterThan(0);
    });
  });
});
