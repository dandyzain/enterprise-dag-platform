import { prisma } from "@/lib/prisma";
import { tryDb } from "@/lib/db/circuit";
import { memoryStore, newId, type MemoryAuditLog } from "@/lib/store/memory-store";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/services/auth-service";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.sessions_revoked"
  | "workflow.saved"
  | "workflow.published"
  | "workflow.status_changed"
  | "workflow.duplicated"
  | "workflow.deleted"
  | "workflow.executed"
  | "execution.retried"
  | "credential.created"
  | "credential.rotated"
  | "credential.deleted"
  | "member.invited"
  | "member.invitation_revoked"
  | "member.joined"
  | "member.role_changed"
  | "member.removed";

export interface AuditEntry {
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

const MAX_MEMORY_AUDIT = 2000;

/**
 * Records who did what. Audit logging must never break the action it
 * describes, so every failure is logged and swallowed.
 */
export async function recordAudit(
  actor: Pick<SessionUser, "id" | "email" | "workspaceId"> | null,
  workspaceId: string,
  action: AuditAction,
  target?: { type: string; id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  const entry: MemoryAuditLog = {
    id: newId("aud"),
    workspaceId,
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    metadata: metadata ?? null,
    createdAt: new Date(),
  };

  try {
    const res = await tryDb(() =>
      prisma.auditLog.create({
        data: {
          workspaceId,
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: (metadata ?? undefined) as object | undefined,
        },
      })
    );
    if (res.ok) return;
  } catch (err) {
    logger.warn("Failed to persist audit log entry", { action, err });
  }

  memoryStore.auditLogs.unshift(entry);
  if (memoryStore.auditLogs.length > MAX_MEMORY_AUDIT) memoryStore.auditLogs.length = MAX_MEMORY_AUDIT;
}

export async function listAuditLogs(workspaceId: string, limit = 100): Promise<AuditEntry[]> {
  try {
    const res = await tryDb(() =>
      prisma.auditLog.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: limit })
    );
    if (res.ok) {
      const fromDb: AuditEntry[] = res.value.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        actorId: r.actorId,
        actorEmail: r.actorEmail,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: (r.metadata as Record<string, unknown> | null) ?? null,
        createdAt: r.createdAt,
      }));
      const fromMemory = memoryStore.auditLogs.filter((e) => e.workspaceId === workspaceId);
      return [...fromDb, ...fromMemory].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    }
  } catch (err) {
    logger.warn("Failed to read audit log", { err });
  }
  return memoryStore.auditLogs.filter((e) => e.workspaceId === workspaceId).slice(0, limit);
}
