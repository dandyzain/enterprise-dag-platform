import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { MemberRole, WorkspaceTier } from "@/lib/auth/rbac";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceTier: WorkspaceTier;
}

const AUTH_COOKIE_NAME = "dag_session_token";
const SECRET = process.env.ENCRYPTION_SECRET_KEY || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// Password Hashing with Salt
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const hashedAttempt = crypto.scryptSync(password, salt, 64);
    const storedHash = Buffer.from(hash, "hex");
    return crypto.timingSafeEqual(hashedAttempt, storedHash);
  } catch {
    return false;
  }
}

// Token Signing (HMAC-SHA256 Stateless Session Token)
export function signSessionToken(session: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;

    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(payload)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return decoded as SessionUser;
  } catch {
    return null;
  }
}

// Demo Multi-Tenant Users (Instant Cloud/Local Sandbox Access)
export const DEMO_USERS: Record<string, { password: string; session: SessionUser }> = {
  "admin@enterprise.io": {
    password: "Password123!",
    session: {
      id: "usr_admin_enterprise",
      email: "admin@enterprise.io",
      name: "Alex Vance (Lead Architect)",
      role: "OWNER",
      workspaceId: "ws_acme_global",
      workspaceName: "Acme Global Enterprise",
      workspaceSlug: "acme-enterprise",
      workspaceTier: "ENTERPRISE",
    },
  },
  "editor@enterprise.io": {
    password: "Password123!",
    session: {
      id: "usr_editor_fintech",
      email: "editor@enterprise.io",
      name: "Marcus Aurelius (DAG Engineer)",
      role: "MEMBER",
      workspaceId: "ws_fintech_core",
      workspaceName: "FinTech Automated Ledger",
      workspaceSlug: "fintech-core",
      workspaceTier: "PRO",
    },
  },
  "viewer@enterprise.io": {
    password: "Password123!",
    session: {
      id: "usr_viewer_auditor",
      email: "viewer@enterprise.io",
      name: "Sarah Chen (Compliance Auditor)",
      role: "VIEWER",
      workspaceId: "ws_audit_labs",
      workspaceName: "Compliance & Security Review",
      workspaceSlug: "compliance-labs",
      workspaceTier: "FREE",
    },
  },
};

// Global in-memory user registry for development fallback
const globalForAuth = globalThis as unknown as {
  registeredUsersMap: Map<string, { passwordHash: string; salt: string; session: SessionUser }> | undefined;
};

const registeredUsers =
  globalForAuth.registeredUsersMap ??
  new Map<string, { passwordHash: string; salt: string; session: SessionUser }>();

if (process.env.NODE_ENV !== "production") {
  globalForAuth.registeredUsersMap = registeredUsers;
}

// Initialize demo users in memory
for (const [email, data] of Object.entries(DEMO_USERS)) {
  if (!registeredUsers.has(email)) {
    const { hash, salt } = hashPassword(data.password);
    registeredUsers.set(email, {
      passwordHash: hash,
      salt,
      session: data.session,
    });
  }
}

export async function authenticateUser(
  email: string,
  passwordAttempt: string
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check in-memory registry / demo users
  const memoryUser = registeredUsers.get(normalizedEmail);
  if (memoryUser) {
    const isValid = verifyPassword(passwordAttempt, memoryUser.passwordHash, memoryUser.salt);
    if (isValid) {
      return { success: true, session: memoryUser.session };
    }
    return { success: false, error: "Invalid email or password." };
  }

  // 2. Fallback to Prisma if database available
  try {
    const dbUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: { workspace: true },
          take: 1,
        },
      },
    });

    if (dbUser && dbUser.passwordHash && dbUser.salt) {
      const isValid = verifyPassword(passwordAttempt, dbUser.passwordHash, dbUser.salt);
      if (isValid) {
        const membership = dbUser.memberships[0];
        const session: SessionUser = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name || "Enterprise User",
          role: (membership?.role as MemberRole) || "MEMBER",
          workspaceId: membership?.workspaceId || "ws_default",
          workspaceName: membership?.workspace.name || "Default Workspace",
          workspaceSlug: membership?.workspace.slug || "default",
          workspaceTier: (membership?.workspace.tier as WorkspaceTier) || "FREE",
        };
        return { success: true, session };
      }
    }
  } catch {
    // Database unreachable, rely on memory store
  }

  return { success: false, error: "Account not found or password incorrect." };
}

export async function registerUser(
  email: string,
  passwordAttempt: string,
  name: string,
  workspaceName = "My Workspace"
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  if (registeredUsers.has(normalizedEmail)) {
    return { success: false, error: "An account with this email already exists." };
  }

  const { hash, salt } = hashPassword(passwordAttempt);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const workspaceSlug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const session: SessionUser = {
    id: userId,
    email: normalizedEmail,
    name: name.trim() || "Workspace Owner",
    role: "OWNER",
    workspaceId,
    workspaceName,
    workspaceSlug,
    workspaceTier: "FREE",
  };

  registeredUsers.set(normalizedEmail, {
    passwordHash: hash,
    salt,
    session,
  });

  return { success: true, session };
}

// Server Action / Component Session Fetcher
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token === "LOGGED_OUT") {
      return null;
    }
    if (token && token.trim() !== "") {
      const verified = verifySessionToken(token);
      if (verified) return verified;
    }
  } catch {
    // cookies() unavailable in certain contexts
  }

  return null;
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}
