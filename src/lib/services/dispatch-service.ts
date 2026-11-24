import { TIER_LIMITS, type WorkspaceTier } from "@/lib/auth/rbac";
import { QuotaError } from "@/lib/auth/guards";
import { createWorkflowExecution, countExecutionsSince } from "@/lib/services/execution-service";
import { getWorkspaceTier } from "@/lib/services/workspace-service";
import { enqueueWorkflowJob } from "@/lib/queue/workflow-queue";
import { validateDAG } from "@/lib/dag/cycle-detection";
import type { WorkflowRecord } from "@/lib/services/workflow-service";

export type RunSource = "manual" | "webhook" | "schedule" | "retry";

function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface UsageSnapshot {
  tier: WorkspaceTier;
  executionsThisMonth: number;
  maxExecutionsPerMonth: number;
}

export async function getUsage(workspaceId: string, tier?: WorkspaceTier): Promise<UsageSnapshot> {
  const resolvedTier = tier ?? (await getWorkspaceTier(workspaceId));
  return {
    tier: resolvedTier,
    executionsThisMonth: await countExecutionsSince(workspaceId, startOfMonthUtc()),
    maxExecutionsPerMonth: TIER_LIMITS[resolvedTier].maxExecutionsPerMonth,
  };
}

/** Throws QuotaError when the workspace has used up this month's executions. */
export async function assertExecutionQuota(workspaceId: string, tier?: WorkspaceTier): Promise<WorkspaceTier> {
  const usage = await getUsage(workspaceId, tier);
  if (usage.executionsThisMonth >= usage.maxExecutionsPerMonth) {
    throw new QuotaError(
      `Monthly execution limit reached (${usage.maxExecutionsPerMonth.toLocaleString("en-US")} runs on the ${usage.tier} plan).`
    );
  }
  return usage.tier;
}

/**
 * Single entry point for starting a run (manual, webhook, schedule, retry):
 * validates the graph, enforces the tier quota, creates the execution record
 * and hands the job to BullMQ (or the in-process fallback runner).
 */
export async function dispatchWorkflowRun(
  workflow: WorkflowRecord,
  triggerPayload: Record<string, unknown>,
  source: RunSource
): Promise<{ executionId: string; mode: "bullmq" | "in-memory-worker" }> {
  const validation = validateDAG(workflow.nodes, workflow.edges);
  if (validation.hasCycle) {
    throw new Error(`Cannot execute: DAG cycle detected (${validation.cycleNodes?.join(" → ")})`);
  }
  if (!workflow.workspaceId) throw new Error("Workflow is not attached to a workspace.");

  const tier = await assertExecutionQuota(workflow.workspaceId);
  const payload = { ...triggerPayload, _source: source };
  const execution = await createWorkflowExecution(workflow.id, payload, workflow.workspaceId);

  const queued = await enqueueWorkflowJob({
    executionId: execution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    workspaceId: workflow.workspaceId,
    workspaceTier: tier,
    nodes: workflow.nodes,
    edges: workflow.edges,
    triggerPayload: payload,
  });

  return { executionId: execution.id, mode: queued.mode };
}
