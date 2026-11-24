import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { tryDb } from "@/lib/db/circuit";
import { canAssignRole, type MemberRole, type WorkspaceTier } from "@/lib/auth/rbac";
import { isDemoUserId } from "@/lib/auth/demo";
import {
  memoryStore,
  findMemoryMembership,
  findMemoryUserByEmail,
  listMemoryMemberships,
  newId,
} from "@/lib/store/memory-store";
import type { SessionUser } from "@/lib/services/auth-service";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  tier: WorkspaceTier;
}

export interface WorkspaceMemberView {
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  joinedAt: Date;
  isDemo: boolean;
}

export interface InvitationView {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
  createdAt: Date;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceInfo | null> {
  const res = await tryDb(() => prisma.workspace.findUnique({ where: { id: workspaceId } }));
  if (res.ok && res.value) {
    return { id: res.value.id, name: res.value.name, slug: res.value.slug, tier: res.value.tier as WorkspaceTier };
  }
  const mem = memoryStore.workspaces.get(workspaceId);
  return mem ? { id: mem.id, name: mem.name, slug: mem.slug, tier: mem.tier } : null;
}

export async function getWorkspaceTier(workspaceId: string | null | undefined): Promise<WorkspaceTier> {
  if (!workspaceId) return "FREE";
  return (await getWorkspace(workspaceId))?.tier ?? "FREE";
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
  const byUser = new Map<string, WorkspaceMemberView>();

  const res = await tryDb(() =>
    prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: true }, orderBy: { createdAt: "asc" } })
  );
  if (res.ok) {
    for (const m of res.value) {
      byUser.set(m.userId, {
        userId: m.userId,
        email: m.user.email,
        name: m.user.name || m.user.email,
        role: m.role as MemberRole,
        joinedAt: m.createdAt,
        isDemo: isDemoUserId(m.userId),
      });
    }
  }

  // Memory members (demo personas, members added during an outage) — demo personas win
  // because their role is fixed by the demo definition.
  for (const m of listMemoryMemberships({ workspaceId })) {
    const user = memoryStore.users.get(m.userId);
    if (!user) continue;
    if (byUser.has(m.userId) && !isDemoUserId(m.userId)) continue;
    const dbCopy = Array.from(byUser.values()).find((v) => v.email === user.email);
    if (dbCopy) byUser.delete(dbCopy.userId);
    byUser.set(m.userId, {
      userId: m.userId,
      email: user.email,
      name: user.name,
      role: m.role,
      joinedAt: m.createdAt,
      isDemo: isDemoUserId(m.userId),
    });
  }

  const order: Record<MemberRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2, VIEWER: 3 };
  return Array.from(byUser.values()).sort((a, b) => order[a.role] - order[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime());
}

async function getMemberRole(workspaceId: string, userId: string): Promise<MemberRole | null> {
  const mem = findMemoryMembership(workspaceId, userId);
  if (mem) return mem.role;
  const res = await tryDb(() =>
    prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } })
  );
  return res.ok && res.value ? (res.value.role as MemberRole) : null;
}

async function countOwners(workspaceId: string): Promise<number> {
  return (await listMembers(workspaceId)).filter((m) => m.role === "OWNER").length;
}

export async function updateMemberRole(
  actor: SessionUser,
  userId: string,
  role: MemberRole
): Promise<{ success: boolean; error?: string }> {
  if (isDemoUserId(userId)) return { success: false, error: "Demo personas have fixed roles." };
  if (userId === actor.id) return { success: false, error: "You can't change your own role." };
  const current = await getMemberRole(actor.workspaceId, userId);
  if (!current) return { success: false, error: "Member not found." };
  if (!canAssignRole(actor.role, current) || !canAssignRole(actor.role, role)) {
    return { success: false, error: "You can only manage members with a lower role than yours." };
  }
  if (current === "OWNER" && role !== "OWNER" && (await countOwners(actor.workspaceId)) <= 1) {
    return { success: false, error: "A workspace needs at least one owner." };
  }

  const mem = findMemoryMembership(actor.workspaceId, userId);
  if (mem) mem.role = role;
  await tryDb(() =>
    prisma.workspaceMember.updateMany({ where: { workspaceId: actor.workspaceId, userId }, data: { role } })
  );
  return { success: true };
}

export async function removeMember(actor: SessionUser, userId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoUserId(userId)) return { success: false, error: "Demo personas can't be removed." };
  if (userId === actor.id) return { success: false, error: "You can't remove yourself." };
  const current = await getMemberRole(actor.workspaceId, userId);
  if (!current) return { success: false, error: "Member not found." };
  if (!canAssignRole(actor.role, current)) {
    return { success: false, error: "You can only remove members with a lower role than yours." };
  }
  if (current === "OWNER" && (await countOwners(actor.workspaceId)) <= 1) {
    return { success: false, error: "A workspace needs at least one owner." };
  }

  const mem = findMemoryMembership(actor.workspaceId, userId);
  if (mem) memoryStore.memberships.delete(mem.id);
  await tryDb(() => prisma.workspaceMember.deleteMany({ where: { workspaceId: actor.workspaceId, userId } }));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Invitations (link based: no e-mail infrastructure required)
// ---------------------------------------------------------------------------

export async function listInvitations(workspaceId: string): Promise<InvitationView[]> {
  const now = new Date();
  const res = await tryDb(() =>
    prisma.invitation.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    })
  );
  const fromDb: InvitationView[] = res.ok
    ? res.value.map((i) => ({ id: i.id, email: i.email, role: i.role as MemberRole, expiresAt: i.expiresAt, createdAt: i.createdAt }))
    : [];
  const fromMemory = Array.from(memoryStore.invitations.values())
    .filter((i) => i.workspaceId === workspaceId && !i.acceptedAt && i.expiresAt > now)
    .map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt }));
  return [...fromDb, ...fromMemory].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createInvitation(
  actor: SessionUser,
  email: string,
  role: MemberRole
): Promise<{ success: true; token: string; invitation: InvitationView } | { success: false; error: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { success: false, error: "Please enter a valid email address." };
  if (!canAssignRole(actor.role, role)) return { success: false, error: "You can only invite members with a lower role than yours." };

  const members = await listMembers(actor.workspaceId);
  if (members.some((m) => m.email === normalizedEmail)) return { success: false, error: "This person is already a member." };

  const token = crypto.randomBytes(24).toString("base64url");
  const now = new Date();
  const invitation = {
    id: newId("inv"),
    workspaceId: actor.workspaceId,
    email: normalizedEmail,
    role,
    tokenHash: hashToken(token),
    invitedById: actor.id,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    acceptedAt: null,
    createdAt: now,
  };

  // Demo workspace invitations stay in memory (the demo workspace may not exist in PostgreSQL yet).
  const res = isDemoUserId(actor.id)
    ? ({ ok: false } as const)
    : await tryDb(() => prisma.invitation.create({ data: { ...invitation, acceptedAt: undefined } }));
  if (!res.ok) memoryStore.invitations.set(invitation.id, invitation);

  return {
    success: true,
    token,
    invitation: { id: invitation.id, email: invitation.email, role, expiresAt: invitation.expiresAt, createdAt: now },
  };
}

export async function revokeInvitation(workspaceId: string, invitationId: string): Promise<boolean> {
  const mem = memoryStore.invitations.get(invitationId);
  if (mem && mem.workspaceId === workspaceId) {
    memoryStore.invitations.delete(invitationId);
    return true;
  }
  const res = await tryDb(() => prisma.invitation.deleteMany({ where: { id: invitationId, workspaceId } }));
  return res.ok && res.value.count > 0;
}

export interface InvitationPreview {
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
}

async function findInvitationByToken(token: string) {
  const tokenHash = hashToken(token);
  for (const inv of memoryStore.invitations.values()) {
    if (inv.tokenHash === tokenHash) return { source: "memory" as const, inv };
  }
  const res = await tryDb(() => prisma.invitation.findUnique({ where: { tokenHash } }));
  if (res.ok && res.value) {
    return {
      source: "db" as const,
      inv: { ...res.value, role: res.value.role as MemberRole },
    };
  }
  return null;
}

export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const found = await findInvitationByToken(token);
  if (!found || found.inv.acceptedAt || found.inv.expiresAt < new Date()) return null;
  const ws = await getWorkspace(found.inv.workspaceId);
  if (!ws) return null;
  return { workspaceId: ws.id, workspaceName: ws.name, email: found.inv.email, role: found.inv.role, expiresAt: found.inv.expiresAt };
}

/** Adds the signed-in user to the invitation's workspace. The account e-mail must match the invite. */
export async function acceptInvitation(
  user: Pick<SessionUser, "id" | "email">,
  token: string
): Promise<{ success: true; workspaceId: string; role: MemberRole } | { success: false; error: string }> {
  const found = await findInvitationByToken(token);
  if (!found || found.inv.acceptedAt || found.inv.expiresAt < new Date()) {
    return { success: false, error: "This invitation is invalid or has expired." };
  }
  const { inv } = found;
  if (inv.email !== user.email.toLowerCase()) {
    return { success: false, error: `This invitation was sent to ${inv.email}. Sign in with that account to accept it.` };
  }
  if (isDemoUserId(user.id)) return { success: false, error: "Demo accounts can't join other workspaces." };

  const existingRole = await getMemberRole(inv.workspaceId, user.id);
  if (!existingRole) {
    const dbUser = await tryDb(() => prisma.user.findUnique({ where: { id: user.id } }));
    const ws = await getWorkspace(inv.workspaceId);
    if (dbUser.ok && dbUser.value && ws) {
      // The workspace may so far only exist in memory (demo workspace): copy it first.
      await prisma.workspace.upsert({
        where: { id: ws.id },
        create: { id: ws.id, name: ws.name, slug: ws.slug, tier: ws.tier },
        update: {},
      });
      await prisma.workspaceMember.create({ data: { workspaceId: inv.workspaceId, userId: user.id, role: inv.role } });
    } else {
      const memberId = newId("mem");
      memoryStore.memberships.set(memberId, {
        id: memberId,
        workspaceId: inv.workspaceId,
        userId: user.id,
        role: inv.role,
        createdAt: new Date(),
      });
      // Make sure the memory store can resolve a session for this user.
      if (!memoryStore.users.has(user.id) && !findMemoryUserByEmail(user.email)) {
        memoryStore.users.set(user.id, {
          id: user.id,
          email: user.email,
          name: user.email,
          passwordHash: null,
          salt: null,
          sessionsRevokedAt: null,
          createdAt: new Date(),
        });
      }
    }
  }

  if (found.source === "memory") {
    inv.acceptedAt = new Date();
  } else {
    await tryDb(() => prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }));
  }
  return { success: true, workspaceId: inv.workspaceId, role: existingRole ?? inv.role };
}
