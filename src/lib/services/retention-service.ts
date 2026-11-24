import { prisma } from "@/lib/prisma";
import { tryDb } from "@/lib/db/circuit";
import type { WorkspaceTier } from "@/lib/auth/rbac";
import { memoryStore } from "@/lib/store/memory-store";
import { pruneExecutionsBefore } from "@/lib/services/execution-service";
import { logger } from "@/lib/logger";

export const RETENTION_DAYS: Record<WorkspaceTier, number> = {
  FREE: 7,
  PRO: 30,
  ENTERPRISE: 90,
};

export interface PruneResult {
  workspaceId: string;
  prunedCount: number;
  cutoffDate: Date;
  tier: WorkspaceTier;
}

/** Deletes one workspace's execution history older than its plan's retention window. */
export async function pruneExecutionAuditLogs(workspaceId: string, tier: WorkspaceTier): Promise<PruneResult> {
  const days = RETENTION_DAYS[tier] ?? RETENTION_DAYS.FREE;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prunedCount = await pruneExecutionsBefore(workspaceId, cutoffDate);
  return { workspaceId, prunedCount, cutoffDate, tier };
}

/** Applies retention to every workspace (run daily by the worker / scheduler). */
export async function pruneAllWorkspaces(): Promise<PruneResult[]> {
  const workspaces = new Map<string, WorkspaceTier>();
  const res = await tryDb(() => prisma.workspace.findMany({ select: { id: true, tier: true } }));
  if (res.ok) for (const ws of res.value) workspaces.set(ws.id, ws.tier as WorkspaceTier);
  for (const ws of memoryStore.workspaces.values()) if (!workspaces.has(ws.id)) workspaces.set(ws.id, ws.tier);

  const results: PruneResult[] = [];
  for (const [id, tier] of workspaces) {
    try {
      results.push(await pruneExecutionAuditLogs(id, tier));
    } catch (err) {
      logger.warn("Retention pruning failed for workspace", { workspaceId: id, err });
    }
  }
  const total = results.reduce((acc, r) => acc + r.prunedCount, 0);
  if (total > 0) logger.info("Execution retention applied", { workspaces: results.length, pruned: total });
  return results;
}
