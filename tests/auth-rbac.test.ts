import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  registerUser,
  authenticateUser,
  SessionUser,
} from "@/lib/services/auth-service";
import { hasPermission, MemberRole, TIER_LIMITS } from "@/lib/auth/rbac";

describe("Phase 1: Multi-Tenancy, Authentication & RBAC Test Suite", () => {
  describe("1. Password Security (Scrypt + Salt)", () => {
    it("should hash password with unique cryptographically random salt", () => {
      const pwd = "SecureMasterPassword2026!";
      const res1 = hashPassword(pwd);
      const res2 = hashPassword(pwd);

      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
      expect(res1.hash.length).toBe(128); // 64 bytes in hex
    });

    it("should successfully verify correct password and reject wrong password", () => {
      const pwd = "EnterpriseAdminSecret!";
      const { hash, salt } = hashPassword(pwd);

      expect(verifyPassword(pwd, hash, salt)).toBe(true);
      expect(verifyPassword("WrongPassword!", hash, salt)).toBe(false);
      expect(verifyPassword("", hash, salt)).toBe(false);
    });
  });

  describe("2. Stateless Session Tokens (HMAC-SHA256)", () => {
    const mockUser: SessionUser = {
      id: "usr_corp_99",
      email: "architect@enterprise.io",
      name: "Lead Architect",
      role: "OWNER",
      workspaceId: "ws_acme_core",
      workspaceName: "Acme Global Core",
      workspaceSlug: "acme-core",
      workspaceTier: "ENTERPRISE",
    };

    it("should sign and verify valid session token losslessly", () => {
      const token = signSessionToken(mockUser);
      expect(token).toContain(".");

      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(mockUser.id);
      expect(verified?.email).toBe(mockUser.email);
      expect(verified?.role).toBe("OWNER");
      expect(verified?.workspaceTier).toBe("ENTERPRISE");
    });

    it("should reject tampered signature or forged payload", () => {
      const token = signSessionToken(mockUser);
      const [payload, sig] = token.split(".");

      // Modify signature
      const tamperedSigToken = `${payload}.${sig.slice(0, -3)}xyz`;
      expect(verifySessionToken(tamperedSigToken)).toBeNull();

      // Modify payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...mockUser, role: "OWNER", email: "hacker@evil.com" })
      ).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${sig}`;
      expect(verifySessionToken(tamperedToken)).toBeNull();
    });
  });

  describe("3. Role-Based Access Control (RBAC) Permissions Matrix", () => {
    it("should allow OWNER full access to edit, delete, publish, and manage vault", () => {
      const role: MemberRole = "OWNER";
      expect(hasPermission(role, "workflow:create")).toBe(true);
      expect(hasPermission(role, "workflow:edit")).toBe(true);
      expect(hasPermission(role, "workflow:delete")).toBe(true);
      expect(hasPermission(role, "workflow:publish")).toBe(true);
      expect(hasPermission(role, "credential:create")).toBe(true);
      expect(hasPermission(role, "workspace:manage")).toBe(true);
    });

    it("should allow MEMBER (Editor) to edit and execute workflows, but not delete or manage workspace", () => {
      const role: MemberRole = "MEMBER";
      expect(hasPermission(role, "workflow:create")).toBe(true);
      expect(hasPermission(role, "workflow:edit")).toBe(true);
      expect(hasPermission(role, "workflow:execute")).toBe(true);
      expect(hasPermission(role, "workflow:delete")).toBe(false);
      expect(hasPermission(role, "workflow:publish")).toBe(false);
      expect(hasPermission(role, "workspace:manage")).toBe(false);
    });

    it("should restrict VIEWER to read-only access (no edit, no execute, no vault mutation)", () => {
      const role: MemberRole = "VIEWER";
      expect(hasPermission(role, "execution:view")).toBe(true);
      expect(hasPermission(role, "workflow:edit")).toBe(false);
      expect(hasPermission(role, "workflow:create")).toBe(false);
      expect(hasPermission(role, "workflow:delete")).toBe(false);
      expect(hasPermission(role, "workflow:execute")).toBe(false);
      expect(hasPermission(role, "credential:create")).toBe(false);
    });
  });

  describe("4. Workspace Tier Limits & Quotas", () => {
    it("should enforce Free, Pro, and Enterprise limits strictly", () => {
      expect(TIER_LIMITS.FREE.maxWorkflows).toBe(3);
      expect(TIER_LIMITS.FREE.allowHardwareKms).toBe(false);

      expect(TIER_LIMITS.PRO.maxWorkflows).toBe(25);
      expect(TIER_LIMITS.PRO.maxExecutionsPerMonth).toBe(50_000);
      expect(TIER_LIMITS.PRO.allowHardwareKms).toBe(true);

      expect(TIER_LIMITS.ENTERPRISE.maxWorkflows).toBeGreaterThan(1000);
      expect(TIER_LIMITS.ENTERPRISE.allowCustomWebhookDomain).toBe(true);
    });
  });

  describe("5. User Registration & Custom Account Authentication", () => {
    it("should allow a new user to register with custom workspace and log in successfully", async () => {
      const email = `dev_${Date.now()}@testcompany.io`;
      const password = "SuperSecretPassword123!";
      const name = "Dev Engineer";
      const workspaceName = "Fintech Pipeline Team";

      const regResult = await registerUser(email, password, name, workspaceName);
      expect(regResult.success).toBe(true);
      expect(regResult.session).toBeDefined();
      expect(regResult.session?.email).toBe(email);
      expect(regResult.session?.name).toBe(name);
      expect(regResult.session?.workspaceName).toBe(workspaceName);
      expect(regResult.session?.role).toBe("OWNER");

      // Attempt login with valid credentials
      const authResult = await authenticateUser(email, password);
      expect(authResult.success).toBe(true);
      expect(authResult.session?.email).toBe(email);
      expect(authResult.session?.name).toBe(name);

      // Attempt login with incorrect password
      const badAuth = await authenticateUser(email, "WrongPassword!");
      expect(badAuth.success).toBe(false);
      expect(badAuth.error).toContain("Invalid email or password");
    });

    it("should reject duplicate email registrations", async () => {
      const email = `dup_${Date.now()}@testcompany.io`;
      const reg1 = await registerUser(email, "Password123!", "User 1", "Team 1");
      expect(reg1.success).toBe(true);

      const reg2 = await registerUser(email, "Password123!", "User 2", "Team 2");
      expect(reg2.success).toBe(false);
      expect(reg2.error).toContain("already exists");
    });
  });
});
