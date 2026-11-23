"use server";

import { revalidatePath } from "next/cache";
import {
  saveWorkflow,
  getWorkflowForWorkspace,
  setWorkflowStatus,
  deleteWorkflow,
  duplicateWorkflow,
  countWorkflows,
  type SaveWorkflowInput,
  type WorkflowRecord,
  type WorkflowStatus,
} from "@/lib/services/workflow-service";
import {
  getExecutionForWorkspace,
  listExecutions,
  type WorkflowExecutionRecord,
} from "@/lib/services/execution-service";
import { ensurePrincipalInDb } from "@/lib/services/auth-service";
import { dispatchWorkflowRun } from "@/lib/services/dispatch-service";
import { recordAudit } from "@/lib/services/audit-service";
import { guarded, requirePermission, AuthError } from "@/lib/auth/guards";
import { TIER_LIMITS } from "@/lib/auth/rbac";
import { isDbAvailable } from "@/lib/db/circuit";
import { validateCron } from "@/lib/dag/cron";
import type { DAGNode } from "@/lib/dag/types";

function validateNodes(nodes: DAGNode[]): string | null {
  for (const node of nodes) {
    if (node.data?.type === "schedule") {
      const cron = String(node.data.config?.cron ?? "").trim();
      const err = cron ? validateCron(cron) : "Schedule trigger needs a cron expression.";
      if (err) return `${node.data.label || node.id}: ${err}`;
    }
  }
  return null;
}

export async function saveWorkflowAction(
  input: Pick<SaveWorkflowInput, "id" | "name" | "description" | "status" | "nodes" | "edges">
): Promise<{ success: boolean; workflow?: WorkflowRecord; error?: string; cycleNodes?: string[] }> {
  return guarded("workflow:edit", async (session) => {
    const nodeError = validateNodes(input.nodes ?? []);
    if (nodeError) return { success: false, error: nodeError };

    const existing = await getWorkflowForWorkspace(input.id, session.workspaceId);
    if (!existing) {
      const limit = TIER_LIMITS[session.workspaceTier].maxWorkflows;
      if ((await countWorkflows(session.workspaceId)) >= limit) {
        return {
          success: false,
          error: `Your ${session.workspaceTier} plan allows ${limit} workflows. Delete one or upgrade to add more.`,
          code: "QUOTA_EXCEEDED",
        };
      }
    }

    // Status changes go through publish/setStatus so they are permission-checked separately.
    const status: WorkflowStatus = existing?.status ?? "DRAFT";
    const userId = isDbAvailable() ? await ensurePrincipalInDb(session) : session.id;

    const result = await saveWorkflow({
      id: input.id,
      name: input.name,
      description: input.description,
      status,
      nodes: input.nodes,
      edges: input.edges,
      userId,
      workspaceId: session.workspaceId,
    });
    if (!result.success || !result.workflow) {
      return { success: false, error: result.error ?? "Failed to save workflow.", cycleNodes: result.cycleNodes };
    }

    await recordAudit(session, session.workspaceId, "workflow.saved", { type: "workflow", id: input.id }, { name: result.workflow.name });
    revalidatePath("/", "layout");
    return { success: true, workflow: result.workflow };
  });
}

export async function publishWorkflowAction(workflowId: string): Promise<{ success: boolean; error?: string }> {
  return guarded("workflow:publish", async (session) => {
    const res = await setWorkflowStatus(workflowId, session.workspaceId, "PUBLISHED");
    if (!res.success) return { success: false, error: res.error ?? "Publish failed." };
    await recordAudit(session, session.workspaceId, "workflow.published", { type: "workflow", id: workflowId });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function setWorkflowStatusAction(
  workflowId: string,
  status: WorkflowStatus
): Promise<{ success: boolean; error?: string }> {
  return guarded("workflow:publish", async (session) => {
    if (!["DRAFT", "PUBLISHED", "DISABLED"].includes(status)) return { success: false, error: "Invalid status." };
    const res = await setWorkflowStatus(workflowId, session.workspaceId, status);
    if (!res.success) return { success: false, error: res.error ?? "Update failed." };
    await recordAudit(session, session.workspaceId, "workflow.status_changed", { type: "workflow", id: workflowId }, { status });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function deleteWorkflowAction(workflowId: string): Promise<{ success: boolean; error?: string }> {
  return guarded("workflow:delete", async (session) => {
    const wf = await getWorkflowForWorkspace(workflowId, session.workspaceId);
    const res = await deleteWorkflow(workflowId, session.workspaceId);
    if (!res.success) return { success: false, error: res.error ?? "Delete failed." };
    await recordAudit(session, session.workspaceId, "workflow.deleted", { type: "workflow", id: workflowId }, { name: wf?.name });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function duplicateWorkflowAction(
  workflowId: string
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  return guarded("workflow:create", async (session) => {
    const limit = TIER_LIMITS[session.workspaceTier].maxWorkflows;
    if ((await countWorkflows(session.workspaceId)) >= limit) {
      return { success: false, error: `Your ${session.workspaceTier} plan allows ${limit} workflows.`, code: "QUOTA_EXCEEDED" };
    }
    const userId = isDbAvailable() ? await ensurePrincipalInDb(session) : session.id;
    const res = await duplicateWorkflow(workflowId, session.workspaceId, userId);
    if (!res.success || !res.workflow) return { success: false, error: res.error ?? "Duplicate failed." };
    await recordAudit(session, session.workspaceId, "workflow.duplicated", { type: "workflow", id: res.workflow.id }, { from: workflowId });
    revalidatePath("/", "layout");
    return { success: true, workflowId: res.workflow.id };
  });
}

export async function triggerWorkflowExecutionAction(
  workflowId: string,
  payload?: Record<string, unknown>
): Promise<{ success: boolean; executionId?: string; mode?: string; error?: string }> {
  return guarded("workflow:execute", async (session) => {
    const workflow = await getWorkflowForWorkspace(workflowId, session.workspaceId);
    if (!workflow) return { success: false, error: "Workflow not found" };
    if (workflow.status === "DISABLED") return { success: false, error: "Workflow is disabled. Enable it to run." };

    const triggerData =
      payload && typeof payload === "object" && !Array.isArray(payload) ? payload : { manualTrigger: true, timestamp: Date.now() };

    try {
      const run = await dispatchWorkflowRun(workflow, triggerData, "manual");
      await recordAudit(session, session.workspaceId, "workflow.executed", { type: "execution", id: run.executionId }, { workflowId });
      return { success: true, executionId: run.executionId, mode: run.mode };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      return { success: false, error: err instanceof Error ? err.message : "Failed to start execution." };
    }
  });
}

export async function getExecutionHistoryAction(workflowId: string): Promise<WorkflowExecutionRecord[]> {
  try {
    const session = await requirePermission("execution:view");
    return await listExecutions({ workspaceId: session.workspaceId, workflowId });
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
}

export async function getSingleExecutionAction(executionId: string): Promise<WorkflowExecutionRecord | null> {
  try {
    const session = await requirePermission("execution:view");
    return await getExecutionForWorkspace(executionId, session.workspaceId);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

export async function retryWorkflowExecutionAction(
  executionId: string
): Promise<{ success: boolean; newExecutionId?: string; error?: string }> {
  return guarded("execution:retry", async (session) => {
    const original = await getExecutionForWorkspace(executionId, session.workspaceId);
    if (!original) return { success: false, error: `Execution ${executionId} not found.` };

    const workflow = await getWorkflowForWorkspace(original.workflowId, session.workspaceId);
    if (!workflow) return { success: false, error: `Parent workflow ${original.workflowId} not found.` };

    const triggerPayload = (original.triggerData as Record<string, unknown>) || { timestamp: Date.now() };
    try {
      const run = await dispatchWorkflowRun(workflow, { ...triggerPayload, _retriedFrom: executionId }, "retry");
      await recordAudit(session, session.workspaceId, "execution.retried", { type: "execution", id: run.executionId }, { from: executionId });
      return { success: true, newExecutionId: run.executionId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Retry failed." };
    }
  });
}
