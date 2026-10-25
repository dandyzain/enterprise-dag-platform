"use server";

import {
  saveWorkflow,
  getWorkflowById,
  listWorkflows,
  SaveWorkflowInput,
  WorkflowRecord,
} from "@/lib/services/workflow-service";
import {
  createWorkflowExecution,
  getWorkflowExecution,
  listWorkflowExecutions,
  WorkflowExecutionRecord,
} from "@/lib/services/execution-service";
import { enqueueWorkflowJob } from "@/lib/queue/workflow-queue";
import { validateDAG } from "@/lib/dag/cycle-detection";

export async function saveWorkflowAction(input: SaveWorkflowInput): Promise<{
  success: boolean;
  workflow?: WorkflowRecord;
  error?: string;
  cycleNodes?: string[];
}> {
  return await saveWorkflow(input);
}

export async function publishWorkflowAction(workflowId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    return { success: false, error: "Workflow not found" };
  }

  const validation = validateDAG(workflow.nodes, workflow.edges);
  if (validation.hasCycle) {
    return {
      success: false,
      error: `Cannot publish: DAG contains cycle (${validation.cycleNodes?.join(" → ")})`,
    };
  }

  const result = await saveWorkflow({
    ...workflow,
    status: "PUBLISHED",
  });

  return { success: result.success, error: result.error };
}

export async function triggerWorkflowExecutionAction(
  workflowId: string,
  payload?: Record<string, unknown>
): Promise<{
  success: boolean;
  executionId?: string;
  mode?: string;
  error?: string;
}> {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    return { success: false, error: "Workflow not found" };
  }

  const validation = validateDAG(workflow.nodes, workflow.edges);
  if (validation.hasCycle) {
    return {
      success: false,
      error: `Cannot execute: DAG cycle detected (${validation.cycleNodes?.join(" → ")})`,
    };
  }

  const triggerData = payload || {
    manualTrigger: true,
    timestamp: Date.now(),
  };

  const execution = await createWorkflowExecution(workflow.id, triggerData);

  const queueResult = await enqueueWorkflowJob({
    executionId: execution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
    triggerPayload: triggerData,
  });

  return {
    success: true,
    executionId: execution.id,
    mode: queueResult.mode,
  };
}

export async function getExecutionHistoryAction(
  workflowId: string
): Promise<WorkflowExecutionRecord[]> {
  return await listWorkflowExecutions(workflowId);
}

export async function getSingleExecutionAction(
  executionId: string
): Promise<WorkflowExecutionRecord | null> {
  return await getWorkflowExecution(executionId);
}

export async function retryWorkflowExecutionAction(executionId: string): Promise<{
  success: boolean;
  newExecutionId?: string;
  error?: string;
}> {
  const original = await getWorkflowExecution(executionId);
  if (!original) {
    return { success: false, error: `Execution ${executionId} not found.` };
  }

  const workflow = await getWorkflowById(original.workflowId);
  if (!workflow) {
    return { success: false, error: `Parent workflow ${original.workflowId} not found.` };
  }

  const triggerPayload = (original.triggerData as Record<string, unknown>) || {
    retryOf: executionId,
    timestamp: Date.now(),
  };

  const newExecution = await createWorkflowExecution(workflow.id, {
    ...triggerPayload,
    _retriedFrom: executionId,
  });

  await enqueueWorkflowJob({
    executionId: newExecution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
    triggerPayload,
  });

  return {
    success: true,
    newExecutionId: newExecution.id,
  };
}
