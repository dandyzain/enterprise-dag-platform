import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { MemberRole, WorkspaceTier } from "@/lib/auth/rbac";
import { getSessionSecret, isDemoMode } from "@/lib/config/env";
import { tryDb, isDbAvailable } from "@/lib/db/circuit";
import { DEMO_ACCOUNTS, DEMO_EMAILS, DEMO_PASSWORD, DEMO_WORKSPACE, isDemoUserId, type DemoEmail } from "@/lib/auth/demo";
import {
  memoryStore,
  findMemoryUserByEmail,
  findMemoryMembership,
  listMemoryMemberships,
  newId,
} from "@/lib/store/memory-store";
import { logger } from "@/lib/logger";

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

export interface SessionClaims extends SessionUser {
  /** Issued at (seconds since epoch). */
  iat: number;
  /** Expires at (seconds since epoch). */
  exp: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  tier: WorkspaceTier;
  role: MemberRole;
}

const AUTH_COOKIE_NAME = "dag_session_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Password hashing (scrypt + per-user salt)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const hashedAttempt = crypto.scryptSync(password, salt, 64);
    const storedHash = Buffer.from(hash, "hex");
    if (storedHash.length !== hashedAttempt.length) return false;
    return crypto.timingSafeEqual(hashedAttempt, storedHash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signed, expiring session tokens (HMAC-SHA256)
// ---------------------------------------------------------------------------

function hmac(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function signSessionToken(session: SessionUser, ttlSeconds = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    workspaceId: session.workspaceId,
    workspaceName: session.workspaceName,
    workspaceSlug: session.workspaceSlug,
    workspaceTier: session.workspaceTier,
    iat: now,
    exp: now + ttlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const [payload, signature, ...rest] = token.split(".");
    if (!payload || !signature || rest.length > 0) return null;

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(hmac(payload));
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Partial<SessionClaims>;
    if (typeof decoded.exp !== "number" || typeof decoded.iat !== "number") return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!decoded.id || !decoded.workspaceId) return null;
    return decoded as SessionClaims;
  } catch {
    return null;
  }
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// ---------------------------------------------------------------------------
// Demo accounts (memory only, confined to the demo workspace)
// ---------------------------------------------------------------------------

/** Backwards-compatible view of the demo accounts. */
export const DEMO_USERS: Record<DemoEmail, { password: string; session: SessionUser }> = Object.fromEntries(
  DEMO_EMAILS.map((email) => {
    const account = DEMO_ACCOUNTS[email];
    return [
      email,
      {
        password: DEMO_PASSWORD,
        session: {
          id: account.id,
          email,
          name: account.name,
          role: account.role,
          workspaceId: DEMO_WORKSPACE.id,
          workspaceName: DEMO_WORKSPACE.name,
          workspaceSlug: DEMO_WORKSPACE.slug,
          workspaceTier: DEMO_WORKSPACE.tier,
        },
      },
    ];
  })
) as Record<DemoEmail, { password: string; session: SessionUser }>;

function seedDemoAccounts(): void {
  if (!isDemoMode()) return;
  if (!memoryStore.workspaces.has(DEMO_WORKSPACE.id)) {
    memoryStore.workspaces.set(DEMO_WORKSPACE.id, { ...DEMO_WORKSPACE, createdAt: new Date() });
  }
  for (const email of DEMO_EMAILS) {
    const account = DEMO_ACCOUNTS[email];
    if (!memoryStore.users.has(account.id)) {
      const { hash, salt } = hashPassword(DEMO_PASSWORD);
      memoryStore.users.set(account.id, {
        id: account.id,
        email,
        name: account.name,
        passwordHash: hash,
        salt,
        sessionsRevokedAt: null,
        createdAt: new Date(),
      });
    }
    if (!findMemoryMembership(DEMO_WORKSPACE.id, account.id)) {
      const id = `mem_${account.id}`;
      memoryStore.memberships.set(id, {
        id,
        workspaceId: DEMO_WORKSPACE.id,
        userId: account.id,
        role: account.role,
        createdAt: new Date(),
      });
    }
  }
}

seedDemoAccounts();

// ---------------------------------------------------------------------------
// Session resolution
// ---------------------------------------------------------------------------

function memorySession(userId: string, preferredWorkspaceId?: string): SessionUser | null {
  const user = memoryStore.users.get(userId);
  if (!user) return null;
  const memberships = listMemoryMemberships({ userId });
  const membership = memberships.find((m) => m.workspaceId === preferredWorkspaceId) ?? memberships[0];
  if (!membership) return null;
  const workspace = memoryStore.workspaces.get(membership.workspaceId);
  if (!workspace) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    workspaceTier: workspace.tier,
  };
}

async function dbSession(
  userId: string,
  preferredWorkspaceId?: string,
  issuedAt?: number
): Promise<{ found: boolean; session: SessionUser | null }> {
  const res = await tryDb(() =>
    prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } } },
    })
  );
  if (!res.ok) return { found: false, session: null };
  const user = res.value;
  if (!user) return { found: false, session: null };

  if (issuedAt && user.sessionsRevokedAt && user.sessionsRevokedAt.getTime() > issuedAt * 1000) {
    return { found: true, session: null };
  }

  const membership = user.memberships.find((m) => m.workspaceId === preferredWorkspaceId) ?? user.memberships[0];
  if (!membership) return { found: true, session: null };

  return {
    found: true,
    session: {
      id: user.id,
      email: user.email,
      name: user.name || "Workspace member",
      role: membership.role as MemberRole,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      workspaceSlug: membership.workspace.slug,
      workspaceTier: membership.workspace.tier as WorkspaceTier,
    },
  };
}

/**
 * Re-resolves a token's principal against the current store so role changes,
 * removals and "sign out everywhere" take effect immediately instead of
 * living on inside a 7-day token.
 */
export async function resolveSession(claims: SessionClaims): Promise<SessionUser | null> {
  if (isDemoUserId(claims.id)) {
    if (!isDemoMode()) return null;
    return memorySession(claims.id, claims.workspaceId);
  }

  const memoryUser = memoryStore.users.get(claims.id);
  if (memoryUser?.sessionsRevokedAt && memoryUser.sessionsRevokedAt.getTime() > claims.iat * 1000) {
    return null;
  }

  if (isDbAvailable()) {
    const fromDb = await dbSession(claims.id, claims.workspaceId, claims.iat);
    if (fromDb.found) return fromDb.session;
  }

  const fromMemory = memorySession(claims.id, claims.workspaceId);
  if (fromMemory) return fromMemory;

  // Database configured but temporarily unreachable: trust the signed token
  // (degraded mode) rather than logging every user out during an outage.
  if (!isDbAvailable() && process.env.DATABASE_URL) {
    const { iat: _iat, exp: _exp, ...session } = claims;
    void _iat;
    void _exp;
    return session;
  }

  return null;
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  } catch {
    // cookies() is unavailable outside a request scope.
    return null;
  }

  if (!token || token === "LOGGED_OUT") return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;
  return resolveSession(claims);
}

// ---------------------------------------------------------------------------
// Authentication & registration
// ---------------------------------------------------------------------------

export async function authenticateUser(
  email: string,
  passwordAttempt: string,
  preferredWorkspaceId?: string
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const invalid = { success: false, error: "Invalid email or password." };

  // 1. Demo accounts (only while demo mode is on)
  const memoryUser = findMemoryUserByEmail(normalizedEmail);
  if (memoryUser && isDemoUserId(memoryUser.id)) {
    if (!isDemoMode() || !memoryUser.passwordHash || !memoryUser.salt) return invalid;
    if (!verifyPassword(passwordAttempt, memoryUser.passwordHash, memoryUser.salt)) return invalid;
    const session = memorySession(memoryUser.id, preferredWorkspaceId);
    return session ? { success: true, session } : invalid;
  }

  // 2. PostgreSQL
  const res = await tryDb(() => prisma.user.findUnique({ where: { email: normalizedEmail } }));
  if (res.ok && res.value) {
    const dbUser = res.value;
    if (!dbUser.passwordHash || !dbUser.salt || !verifyPassword(passwordAttempt, dbUser.passwordHash, dbUser.salt)) {
      return invalid;
    }
    const resolved = await dbSession(dbUser.id, preferredWorkspaceId);
    if (!resolved.session) {
      return { success: false, error: "This account is not a member of any workspace." };
    }
    return { success: true, session: resolved.session };
  }

  // 3. Users registered while the database was unavailable
  if (memoryUser?.passwordHash && memoryUser.salt) {
    if (!verifyPassword(passwordAttempt, memoryUser.passwordHash, memoryUser.salt)) return invalid;
    const session = memorySession(memoryUser.id, preferredWorkspaceId);
    return session ? { success: true, session } : invalid;
  }

  // Equalise timing between "unknown email" and "wrong password".
  verifyPassword(passwordAttempt, "00", "timing-equaliser");
  return invalid;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export async function registerUser(
  email: string,
  passwordAttempt: string,
  name: string,
  workspaceName = "My Workspace"
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const displayName = name.trim() || "Workspace Owner";
  const wsName = workspaceName.trim() || "My Workspace";
  const duplicate = { success: false, error: "An account with this email already exists." };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (passwordAttempt.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (findMemoryUserByEmail(normalizedEmail)) return duplicate;

  const { hash, salt } = hashPassword(passwordAttempt);
  const slug = `${slugify(wsName)}-${crypto.randomBytes(2).toString("hex")}`;

  // 1. Durable path: PostgreSQL
  if (isDbAvailable()) {
    try {
      const res = await tryDb(async () => {
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) return null;
        return prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: normalizedEmail, name: displayName, passwordHash: hash, salt },
          });
          const workspace = await tx.workspace.create({ data: { name: wsName, slug, tier: "FREE" } });
          await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
          return { user, workspace };
        });
      });

      if (res.ok) {
        if (!res.value) return duplicate;
        const { user, workspace } = res.value;
        return {
          success: true,
          session: {
            id: user.id,
            email: user.email,
            name: displayName,
            role: "OWNER",
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            workspaceTier: "FREE",
          },
        };
      }
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return duplicate;
      throw err;
    }
  }

  // 2. Fallback: in-memory (not durable — logged so operators notice)
  logger.warn("Registering user in the in-memory store; configure DATABASE_URL for durable accounts", {
    email: normalizedEmail,
  });
  const userId = newId("usr");
  const workspaceId = newId("ws");
  memoryStore.users.set(userId, {
    id: userId,
    email: normalizedEmail,
    name: displayName,
    passwordHash: hash,
    salt,
    sessionsRevokedAt: null,
    createdAt: new Date(),
  });
  memoryStore.workspaces.set(workspaceId, { id: workspaceId, name: wsName, slug, tier: "FREE", createdAt: new Date() });
  const membershipId = newId("mem");
  memoryStore.memberships.set(membershipId, {
    id: membershipId,
    workspaceId,
    userId,
    role: "OWNER",
    createdAt: new Date(),
  });

  return {
    success: true,
    session: {
      id: userId,
      email: normalizedEmail,
      name: displayName,
      role: "OWNER",
      workspaceId,
      workspaceName: wsName,
      workspaceSlug: slug,
      workspaceTier: "FREE",
    },
  };
}

// ---------------------------------------------------------------------------
// Account management
// ---------------------------------------------------------------------------

export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  if (!isDemoUserId(userId)) {
    const res = await tryDb(() =>
      prisma.workspaceMember.findMany({ where: { userId }, include: { workspace: true }, orderBy: { createdAt: "asc" } })
    );
    if (res.ok && res.value.length > 0) {
      return res.value.map((m) => ({
        id: m.workspaceId,
        name: m.workspace.name,
        slug: m.workspace.slug,
        tier: m.workspace.tier as WorkspaceTier,
        role: m.role as MemberRole,
      }));
    }
  }
  return listMemoryMemberships({ userId })
    .map((m) => {
      const ws = memoryStore.workspaces.get(m.workspaceId);
      return ws ? { id: ws.id, name: ws.name, slug: ws.slug, tier: ws.tier, role: m.role } : null;
    })
    .filter((w): w is WorkspaceSummary => w !== null);
}

export async function switchWorkspace(session: SessionUser, workspaceId: string): Promise<SessionUser | null> {
  const workspaces = await listUserWorkspaces(session.id);
  if (!workspaces.some((w) => w.id === workspaceId)) return null;
  if (isDemoUserId(session.id) || !isDbAvailable()) return memorySession(session.id, workspaceId);
  return (await dbSession(session.id, workspaceId)).session ?? memorySession(session.id, workspaceId);
}

export async function updateProfileName(userId: string, name: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return { success: false, error: "Name must be 2–80 characters." };
  if (isDemoUserId(userId)) return { success: false, error: "Demo accounts cannot be modified." };

  const memoryUser = memoryStore.users.get(userId);
  if (memoryUser) memoryUser.name = trimmed;

  const res = await tryDb(() => prisma.user.updateMany({ where: { id: userId }, data: { name: trimmed } }));
  if (res.ok && res.value.count === 0 && !memoryUser) return { success: false, error: "Account not found." };
  return { success: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoUserId(userId)) return { success: false, error: "Demo accounts cannot be modified." };
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const { hash, salt } = hashPassword(newPassword);
  const now = new Date();

  const res = await tryDb(() => prisma.user.findUnique({ where: { id: userId } }));
  if (res.ok && res.value) {
    const user = res.value;
    if (!user.passwordHash || !user.salt || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      return { success: false, error: "Current password is incorrect." };
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, salt, sessionsRevokedAt: now },
    });
    return { success: true };
  }

  const memoryUser = memoryStore.users.get(userId);
  if (!memoryUser || !memoryUser.passwordHash || !memoryUser.salt) return { success: false, error: "Account not found." };
  if (!verifyPassword(currentPassword, memoryUser.passwordHash, memoryUser.salt)) {
    return { success: false, error: "Current password is incorrect." };
  }
  memoryUser.passwordHash = hash;
  memoryUser.salt = salt;
  memoryUser.sessionsRevokedAt = now;
  return { success: true };
}

/** Invalidates every token issued before now for this user. */
export async function revokeAllSessions(userId: string): Promise<void> {
  const now = new Date();
  const memoryUser = memoryStore.users.get(userId);
  if (memoryUser && !isDemoUserId(userId)) memoryUser.sessionsRevokedAt = now;
  if (!isDemoUserId(userId)) {
    await tryDb(() => prisma.user.updateMany({ where: { id: userId }, data: { sessionsRevokedAt: now } }));
  }
}

// ---------------------------------------------------------------------------
// Database principal provisioning (for foreign keys)
// ---------------------------------------------------------------------------

const provisioned = new Map<string, string>();

/**
 * Makes sure the session's user, workspace and membership exist in PostgreSQL
 * before rows that reference them are written (demo accounts and users
 * created during an outage live only in memory). Returns the database user id.
 */
export async function ensurePrincipalInDb(session: SessionUser): Promise<string> {
  const cacheKey = `${session.id}:${session.workspaceId}`;
  const cached = provisioned.get(cacheKey);
  if (cached) return cached;

  const existing = await prisma.user.findUnique({ where: { id: session.id } });
  let dbUserId = existing?.id;
  if (!dbUserId) {
    const memoryUser = memoryStore.users.get(session.id);
    const user = await prisma.user.upsert({
      where: { email: session.email },
      create: {
        id: session.id,
        email: session.email,
        name: session.name,
        passwordHash: isDemoUserId(session.id) ? null : memoryUser?.passwordHash ?? null,
        salt: isDemoUserId(session.id) ? null : memoryUser?.salt ?? null,
      },
      update: {},
    });
    dbUserId = user.id;
  }

  await prisma.workspace.upsert({
    where: { id: session.workspaceId },
    create: { id: session.workspaceId, name: session.workspaceName, slug: session.workspaceSlug, tier: session.workspaceTier },
    update: {},
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: session.workspaceId, userId: dbUserId } },
    create: { workspaceId: session.workspaceId, userId: dbUserId, role: session.role },
    update: {},
  });

  provisioned.set(cacheKey, dbUserId);
  return dbUserId;
}
