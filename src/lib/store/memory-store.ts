/**
 * In-memory fallback store used when PostgreSQL is not configured or is
 * temporarily unreachable (demos, local development without Docker, tests).
 *
 * It is pinned on globalThis so Next.js dev reloads and the separate server
 * bundles share one copy. Data here is NOT durable: production deployments
 * must configure DATABASE_URL.
 */
import type { MemberRole, WorkspaceTier } from "@/lib/auth/rbac";

export interface MemoryUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  salt: string | null;
  sessionsRevokedAt: Date | null;
  createdAt: Date;
}

export interface MemoryWorkspace {
  id: string;
  name: string;
  slug: string;
  tier: WorkspaceTier;
  createdAt: Date;
}

export interface MemoryMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  createdAt: Date;
}

export interface MemoryInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: MemberRole;
  tokenHash: string;
  invitedById: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface MemoryAuditLog {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MemoryStore {
  users: Map<string, MemoryUser>;
  workspaces: Map<string, MemoryWorkspace>;
  memberships: Map<string, MemoryMembership>;
  invitations: Map<string, MemoryInvitation>;
  auditLogs: MemoryAuditLog[];
}

const globalForStore = globalThis as unknown as { __nfMemoryStore?: MemoryStore };

export const memoryStore: MemoryStore =
  globalForStore.__nfMemoryStore ??
  (globalForStore.__nfMemoryStore = {
    users: new Map(),
    workspaces: new Map(),
    memberships: new Map(),
    invitations: new Map(),
    auditLogs: [],
  });

export function findMemoryUserByEmail(email: string): MemoryUser | undefined {
  const normalized = email.toLowerCase().trim();
  for (const user of memoryStore.users.values()) {
    if (user.email === normalized) return user;
  }
  return undefined;
}

export function findMemoryMembership(workspaceId: string, userId: string): MemoryMembership | undefined {
  for (const m of memoryStore.memberships.values()) {
    if (m.workspaceId === workspaceId && m.userId === userId) return m;
  }
  return undefined;
}

export function listMemoryMemberships(filter: { workspaceId?: string; userId?: string }): MemoryMembership[] {
  return Array.from(memoryStore.memberships.values()).filter(
    (m) => (!filter.workspaceId || m.workspaceId === filter.workspaceId) && (!filter.userId || m.userId === filter.userId)
  );
}

/** A small bounded map: oldest entries are evicted once `max` is exceeded. */
export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly max: number) {
    super();
  }

  override set(key: K, value: V): this {
    if (super.has(key)) super.delete(key);
    super.set(key, value);
    while (this.size > this.max) {
      const oldest = this.keys().next().value as K;
      super.delete(oldest);
    }
    return this;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
