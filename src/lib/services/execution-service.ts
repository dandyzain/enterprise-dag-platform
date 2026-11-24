import { prisma } from "@/lib/prisma";
import type { ExecutionState } from "@/lib/dag/types";
import { tryDb, forceDbOffline, isDbAvailable } from "@/lib/db/circuit";
import { BoundedMap } from "@/lib/store/memory-store";
import {
  executionEventEmitter,
  publishExecutionEvent,
  type ExecutionEventPayload,
} from "@/lib/queue/execution-events";

export { executionEventEmitter };
export type { ExecutionEventPayload };

export interface StepExecutionRecord {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeType: string;
  status: ExecutionState;
  inputData?: Record<string, unknown> | null;
  outputData?: unknown | null;
  errorMessage?: string | null;
  durationMs?: number | null;
}

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workspaceId?: string | null;
  status: ExecutionState;
  triggerData?: Record<string, unknown> | null;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  steps: StepExecutionRecord[];
}

const TERMINAL: ExecutionState[] = ["SUCCESS", "FAILED"];
const MAX_MEMORY_EXECUTIONS = 1000;

// In-memory fallback (bounded: the oldest runs are evicted instead of growing forever).
const globalForMemory = globalThis as unknown as { __nfExecutions?: BoundedMap<string, WorkflowExecutionRecord> };
const memoryExecutions: BoundedMap<string, WorkflowExecutionRecord> =
  globalForMemory.__nfExecutions ?? (globalForMemory.__nfExecutions = new BoundedMap(MAX_MEMORY_EXECUTIONS));

/** @deprecated kept for tests: forces the in-memory store for every service. */
export function setExecutionDbAvailability(available: boolean): void {
  forceDbOffline(!available);
}

export function isExecutionDbAvailable(): boolean {
  return isDbAvailable();
}

function newExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

type DbStep = {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  inputData: unknown;
  outputData: unknown;
  errorMessage: string | null;
  durationMs: number | null;
};

type DbExecution = {
  id: string;
  workflowId: string;
  status: string;
  triggerData: unknown;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  steps: DbStep[];
  workflow?: { workspaceId: string | null } | null;
};

function stepFromDb(s: DbStep): StepExecutionRecord {
  return {
    id: s.id,
    workflowExecutionId: s.workflowExecutionId,
    nodeId: s.nodeId,
    nodeType: s.nodeType,
    status: s.status as ExecutionState,
    inputData: s.inputData as Record<string, unknown> | null,
    outputData: s.outputData,
    errorMessage: s.errorMessage,
    durationMs: s.durationMs,
  };
}

function fromDb(r: DbExecution): WorkflowExecutionRecord {
  return {
    id: r.id,
    workflowId: r.workflowId,
    workspaceId: r.workflow?.workspaceId ?? null,
    status: r.status as ExecutionState,
    triggerData: r.triggerData as Record<string, unknown> | null,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    durationMs: r.durationMs,
    steps: r.steps.map(stepFromDb),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createWorkflowExecution(
  workflowId: string,
  triggerData?: Record<string, unknown>,
  workspaceId?: string | null
): Promise<WorkflowExecutionRecord> {
  const record: WorkflowExecutionRecord = {
    id: newExecutionId(),
    workflowId,
    workspaceId: workspaceId ?? null,
    status: "PENDING",
    triggerData: triggerData || null,
    startedAt: new Date(),
    completedAt: null,
    durationMs: null,
    steps: [],
  };

  const res = await tryDb(() =>
    prisma.workflowExecution.create({
      data: {
        id: record.id,
        workflowId: record.workflowId,
        status: "PENDING",
        triggerData: (record.triggerData ?? undefined) as object | undefined,
        startedAt: record.startedAt,
      },
    })
  );
  if (!res.ok) memoryExecutions.set(record.id, record);
  return record;
}

export async function updateWorkflowExecutionStatus(
  executionId: string,
  status: ExecutionState,
  durationMs?: number
): Promise<void> {
  const completedAt = TERMINAL.includes(status) ? new Date() : null;

  const res = await tryDb(() =>
    prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status, completedAt, durationMs: durationMs ?? null },
    })
  );
  if (!res.ok) {
    const existing = memoryExecutions.get(executionId);
    if (existing) {
      existing.status = status;
      existing.completedAt = completedAt;
      if (durationMs !== undefined) existing.durationMs = durationMs;
    }
  }

  publishExecutionEvent({
    executionId,
    type: TERMINAL.includes(status) ? "completed" : "status_changed",
    data: { status, completedAt, durationMs },
  });
}

/** Removes step rows of an execution (used when a queue retry re-runs it). */
export async function resetExecutionSteps(executionId: string): Promise<void> {
  const res = await tryDb(() => prisma.stepExecution.deleteMany({ where: { workflowExecutionId: executionId } }));
  if (!res.ok) {
    const existing = memoryExecutions.get(executionId);
    if (existing) existing.steps = [];
  }
}

export async function recordStepExecution(step: {
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: ExecutionState;
  inputData?: Record<string, unknown>;
  outputData?: unknown;
  errorMessage?: string;
  durationMs?: number;
}): Promise<StepExecutionRecord> {
  const record: StepExecutionRecord = {
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    workflowExecutionId: step.executionId,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    status: step.status,
    inputData: step.inputData || null,
    outputData: step.outputData !== undefined ? step.outputData : null,
    errorMessage: step.errorMessage || null,
    durationMs: step.durationMs ?? null,
  };

  const res = await tryDb(() =>
    prisma.stepExecution.create({
      data: {
        id: record.id,
        workflowExecutionId: record.workflowExecutionId,
        nodeId: record.nodeId,
        nodeType: record.nodeType,
        status: record.status,
        inputData: (record.inputData ?? undefined) as object | undefined,
        outputData: (record.outputData ?? undefined) as object | undefined,
        errorMessage: record.errorMessage,
        durationMs: record.durationMs,
      },
    })
  );

  if (!res.ok) {
    const parent = memoryExecutions.get(step.executionId);
    if (parent) {
      const existingIndex = parent.steps.findIndex((s) => s.nodeId === step.nodeId);
      if (existingIndex >= 0) parent.steps[existingIndex] = record;
      else parent.steps.push(record);
    }
  }

  publishExecutionEvent({ executionId: step.executionId, type: "step_recorded", data: record });
  return record;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Unscoped lookup — only for trusted server code. */
export async function getWorkflowExecution(executionId: string): Promise<WorkflowExecutionRecord | null> {
  const res = await tryDb(() =>
    prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { steps: { orderBy: { id: "asc" } }, workflow: { select: { workspaceId: true } } },
    })
  );
  if (res.ok) return res.value ? fromDb(res.value) : null;
  return memoryExecutions.get(executionId) ?? null;
}

export const getWorkflowExecutionById = getWorkflowExecution;

/** Tenant-scoped lookup. */
export async function getExecutionForWorkspace(
  executionId: string,
  workspaceId: string
): Promise<WorkflowExecutionRecord | null> {
  const exec = await getWorkflowExecution(executionId);
  if (!exec || exec.workspaceId !== workspaceId) return null;
  return exec;
}

export async function listExecutions(options: {
  workspaceId: string;
  workflowId?: string;
  limit?: number;
}): Promise<WorkflowExecutionRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const res = await tryDb(() =>
    prisma.workflowExecution.findMany({
      where: {
        workflow: { workspaceId: options.workspaceId },
        ...(options.workflowId ? { workflowId: options.workflowId } : {}),
      },
      include: { steps: { orderBy: { id: "asc" } }, workflow: { select: { workspaceId: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    })
  );
  if (res.ok) return res.value.map(fromDb);

  return Array.from(memoryExecutions.values())
    .filter((e) => e.workspaceId === options.workspaceId && (!options.workflowId || e.workflowId === options.workflowId))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit);
}

/** Back-compat helper used by tests and tooling (unscoped, memory or DB). */
export async function listWorkflowExecutions(workflowId?: string): Promise<WorkflowExecutionRecord[]> {
  const res = await tryDb(() =>
    prisma.workflowExecution.findMany({
      where: workflowId ? { workflowId } : undefined,
      include: { steps: true, workflow: { select: { workspaceId: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    })
  );
  if (res.ok) return res.value.map(fromDb);
  return Array.from(memoryExecutions.values())
    .filter((e) => !workflowId || e.workflowId === workflowId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/** Number of runs started by a workspace since `since` (quota enforcement). */
export async function countExecutionsSince(workspaceId: string, since: Date): Promise<number> {
  const res = await tryDb(() =>
    prisma.workflowExecution.count({ where: { workflow: { workspaceId }, startedAt: { gte: since } } })
  );
  if (res.ok) return res.value;
  let count = 0;
  for (const e of memoryExecutions.values()) {
    if (e.workspaceId === workspaceId && e.startedAt >= since) count++;
  }
  return count;
}

/** Deletes runs that started before `cutoff` for one workspace. */
export async function pruneExecutionsBefore(workspaceId: string, cutoff: Date): Promise<number> {
  const res = await tryDb(() =>
    prisma.workflowExecution.deleteMany({ where: { workflow: { workspaceId }, startedAt: { lt: cutoff } } })
  );
  if (res.ok) return res.value.count;
  let pruned = 0;
  for (const [id, e] of memoryExecutions.entries()) {
    if (e.workspaceId === workspaceId && e.startedAt < cutoff) {
      memoryExecutions.delete(id);
      pruned++;
    }
  }
  return pruned;
}
