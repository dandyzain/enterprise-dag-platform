import { prisma } from "@/lib/prisma";
import { isExecutionDbAvailable } from "@/lib/services/execution-service";
import { WorkspaceTier } from "@/lib/auth/rbac";

export const RETENTION_DAYS: Record<WorkspaceTier, number> = {
  FREE: 7,
  PRO: 30,
  ENTERPRISE: 90,
};

export interface PruneResult {
  prunedCount: number;
  cutoffDate: Date;
  tier: WorkspaceTier;
}

export async function pruneExecutionAuditLogs(
  tier: WorkspaceTier = "FREE"
): Promise<PruneResult> {
  const days = RETENTION_DAYS[tier];
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let prunedCount = 0;

  if (isExecutionDbAvailable()) {
    try {
      const deleteResult = await prisma.workflowExecution.deleteMany({
        where: {
          startedAt: {
            lt: cutoffDate,
          },
        },
      });
      prunedCount = deleteResult.count;
    } catch {
      // Fallback
    }
  }

  return {
    prunedCount,
    cutoffDate,
    tier,
  };
}
