export type WorkflowNodeType = "trigger" | "webhook" | "schedule" | "action" | "transform" | "delay" | "filter";

/** Node types that start a workflow (no inbound edges). */
export const TRIGGER_NODE_TYPES: WorkflowNodeType[] = ["trigger", "webhook", "schedule"];

export type ExecutionState = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export interface NodeData {
  label: string;
  type: WorkflowNodeType;
  description?: string;
  config: Record<string, unknown>;
  executionState?: ExecutionState;
  executionError?: string;
  executionDurationMs?: number;
}

export interface DAGNode {
  id: string;
  type?: string;
  data: NodeData;
  position?: { x: number; y: number };
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
}

export interface GraphValidationResult {
  isValid: boolean;
  hasCycle: boolean;
  cycleNodes?: string[];
  errorMessage?: string;
  roots: string[];
  terminals: string[];
}
