import { EventEmitter } from "node:events";
import { prisma } from "@/lib/prisma";
import { ExecutionState } from "@/lib/dag/types";

export interface ExecutionEventPayload {
  executionId: string;
  type: "status_changed" | "step_recorded" | "completed";
  data: unknown;
}

const globalForEmitter = globalThis as unknown as {
  executionEventEmitter: EventEmitter | undefined;
};

export const executionEventEmitter =
  globalForEmitter.executionEventEmitter ?? new EventEmitter();
executionEventEmitter.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.executionEventEmitter = executionEventEmitter;
}

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
  status: ExecutionState;
  triggerData?: Record<string, unknown> | null;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  steps: StepExecutionRecord[];
}

// In-memory fallback execution storage (persisted across Next.js dev bundles via globalThis)
const globalForMemory = globalThis as unknown as {
  executionMemoryMap: Map<string, WorkflowExecutionRecord> | undefined;
  executionDbAvailable: boolean | undefined;
};

const memoryExecutions =
  globalForMemory.executionMemoryMap ?? new Map<string, WorkflowExecutionRecord>();

if (process.env.NODE_ENV !== "production") {
  globalForMemory.executionMemoryMap = memoryExecutions;
}

// Fast circuit breaker for database resilience
let isDbAvailable = globalForMemory.executionDbAvailable ?? true;

export function setExecutionDbAvailability(available: boolean): void {
  isDbAvailable = available;
  if (process.env.NODE_ENV !== "production") {
    globalForMemory.executionDbAvailable = available;
  }
}

export function isExecutionDbAvailable(): boolean {
  return isDbAvailable;
}

export async function createWorkflowExecution(
  workflowId: string,
  triggerData?: Record<string, unknown>
): Promise<WorkflowExecutionRecord> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: WorkflowExecutionRecord = {
    id: executionId,
    workflowId,
    status: "PENDING",
    triggerData: triggerData || null,
    startedAt: new Date(),
    completedAt: null,
    durationMs: null,
    steps: [],
  };

  if (isDbAvailable) {
    try {
      const dbCreated = await prisma.workflowExecution.create({
        data: {
          id: record.id,
          workflowId: record.workflowId,
          status: "PENDING",
          triggerData: record.triggerData as object,
          startedAt: record.startedAt,
        },
      });
      record.id = dbCreated.id;
    } catch {
      setExecutionDbAvailability(false);
    }
  }

  memoryExecutions.set(record.id, record);
  return record;
}

export async function updateWorkflowExecutionStatus(
  executionId: string,
  status: ExecutionState,
  durationMs?: number
): Promise<void> {
  const completedAt = status === "SUCCESS" || status === "FAILED" ? new Date() : null;

  if (isDbAvailable) {
    try {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status,
          completedAt,
          durationMs: durationMs || null,
        },
      });
    } catch {
      setExecutionDbAvailability(false);
    }
  }

  const existing = memoryExecutions.get(executionId);
  if (existing) {
    existing.status = status;
    existing.completedAt = completedAt;
    if (durationMs !== undefined) {
      existing.durationMs = durationMs;
    }
  }

  // Publish event for real-time SSE telemetry
  executionEventEmitter.emit(`exec:${executionId}`, {
    executionId,
    type: status === "SUCCESS" || status === "FAILED" ? "completed" : "status_changed",
    data: { status, completedAt, durationMs },
  });
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
  const stepId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: StepExecutionRecord = {
    id: stepId,
    workflowExecutionId: step.executionId,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    status: step.status,
    inputData: step.inputData || null,
    outputData: step.outputData !== undefined ? step.outputData : null,
    errorMessage: step.errorMessage || null,
    durationMs: step.durationMs || null,
  };

  if (isDbAvailable) {
    try {
      await prisma.stepExecution.create({
        data: {
          id: record.id,
          workflowExecutionId: record.workflowExecutionId,
          nodeId: record.nodeId,
          nodeType: record.nodeType,
          status: record.status,
          inputData: record.inputData as object,
          outputData: record.outputData as object,
          errorMessage: record.errorMessage,
          durationMs: record.durationMs,
        },
      });
    } catch {
      setExecutionDbAvailability(false);
    }
  }

  const parent = memoryExecutions.get(step.executionId);
  if (parent) {
    const existingIndex = parent.steps.findIndex((s) => s.nodeId === step.nodeId);
    if (existingIndex >= 0) {
      parent.steps[existingIndex] = record;
    } else {
      parent.steps.push(record);
    }
  }

  // Publish event for real-time SSE telemetry
  executionEventEmitter.emit(`exec:${step.executionId}`, {
    executionId: step.executionId,
    type: "step_recorded",
    data: record,
  });

  return record;
}

export async function getWorkflowExecution(
  executionId: string
): Promise<WorkflowExecutionRecord | null> {
  if (isDbAvailable) {
    try {
      const dbRecord = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
        include: {
          steps: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (dbRecord) {
        return {
          id: dbRecord.id,
          workflowId: dbRecord.workflowId,
          status: dbRecord.status as ExecutionState,
          triggerData: dbRecord.triggerData as Record<string, unknown> | null,
          startedAt: dbRecord.startedAt,
          completedAt: dbRecord.completedAt,
          durationMs: dbRecord.durationMs,
          steps: dbRecord.steps.map((s) => ({
            id: s.id,
            workflowExecutionId: s.workflowExecutionId,
            nodeId: s.nodeId,
            nodeType: s.nodeType,
            status: s.status as ExecutionState,
            inputData: s.inputData as Record<string, unknown> | null,
            outputData: s.outputData,
            errorMessage: s.errorMessage,
            durationMs: s.durationMs,
          })),
        };
      }
    } catch {
      setExecutionDbAvailability(false);
    }
  }

  return memoryExecutions.get(executionId) || null;
}

export const getWorkflowExecutionById = getWorkflowExecution;

export async function listWorkflowExecutions(
  workflowId?: string
): Promise<WorkflowExecutionRecord[]> {
  try {
    const records = await prisma.workflowExecution.findMany({
      where: workflowId ? { workflowId } : undefined,
      include: { steps: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    if (records.length > 0) {
      return records.map((r) => ({
        id: r.id,
        workflowId: r.workflowId,
        status: r.status as ExecutionState,
        triggerData: r.triggerData as Record<string, unknown> | null,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        durationMs: r.durationMs,
        steps: r.steps.map((s) => ({
          id: s.id,
          workflowExecutionId: s.workflowExecutionId,
          nodeId: s.nodeId,
          nodeType: s.nodeType,
          status: s.status as ExecutionState,
          inputData: s.inputData as Record<string, unknown> | null,
          outputData: s.outputData,
          errorMessage: s.errorMessage,
          durationMs: s.durationMs,
        })),
      }));
    }
  } catch {
    // Fall back to memory
  }

  const list: WorkflowExecutionRecord[] = [];
  for (const exec of memoryExecutions.values()) {
    if (!workflowId || exec.workflowId === workflowId) {
      list.push(exec);
    }
  }
  return list.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}
