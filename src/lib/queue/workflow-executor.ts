import { DAGNode, DAGEdge, WorkflowNodeType, NodeData } from "@/lib/dag/types";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { interpolateVariables, ExecutionContext } from "@/lib/dag/variable-interpolator";
import {
  updateWorkflowExecutionStatus,
  recordStepExecution,
} from "@/lib/services/execution-service";
import { validateSafeUrl } from "@/lib/security/anti-ssrf";

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  workflowName: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  triggerPayload: Record<string, unknown>;
}

/**
 * Core DAG Workflow Execution Engine.
 * Executes nodes in strict topological order, passes interpolated variables,
 * evaluates conditional gates, dispatches HTTP requests, and persists audit logs.
 */
export async function executeDAGWorkflow(job: ExecutionJobData): Promise<{
  success: boolean;
  durationMs: number;
  error?: string;
}> {
  const startTime = performance.now();
  await updateWorkflowExecutionStatus(job.executionId, "RUNNING");

  // Build context
  const context: ExecutionContext = {
    trigger: {
      body: job.triggerPayload,
      timestamp: Date.now(),
    },
    steps: {},
  };

  try {
    // 1. Determine topological execution batches
    const { executionBatches } = getTopologicalOrder(job.nodes, job.edges);

    const nodeMap = new Map<string, DAGNode>();
    for (const node of job.nodes) {
      nodeMap.set(node.id, node);
    }

    const skippedNodeIds = new Set<string>();

    // 2. Process each topological batch
    for (const batch of executionBatches) {
      for (const nodeId of batch) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // If upstream filter failed and flagged skipping
        if (skippedNodeIds.has(nodeId)) {
          await recordStepExecution({
            executionId: job.executionId,
            nodeId,
            nodeType: node.data.type,
            status: "FAILED",
            errorMessage: "Skipped: Upstream conditional filter evaluated to false",
            durationMs: 0,
          });

          // Propagate skip to downstream dependencies
          for (const edge of job.edges) {
            if (edge.source === nodeId) {
              skippedNodeIds.add(edge.target);
            }
          }
          continue;
        }

        const stepStartTime = performance.now();
        const nodeType = (node.data.type || "action") as WorkflowNodeType;

        try {
          // Resolve interpolated parameters
          const resolvedConfig = interpolateVariables(
            node.data.config || {},
            context
          ) as Record<string, unknown>;

          let stepOutput: unknown = null;

          if (nodeType === "trigger") {
            stepOutput = {
              success: true,
              payload: job.triggerPayload,
            };
          } else if (nodeType === "webhook") {
            stepOutput = {
              success: true,
              payload: job.triggerPayload,
            };
          } else if (nodeType === "action") {
            // Execute real HTTP Action
            stepOutput = await executeHttpAction(resolvedConfig);
          } else if (nodeType === "filter") {
            // Evaluate Boolean Filter Gate
            const filterResult = evaluateFilterGate(resolvedConfig);
            stepOutput = filterResult;

            if (!filterResult.matched) {
              // Mark downstream dependents to skip
              for (const edge of job.edges) {
                if (edge.source === nodeId) {
                  skippedNodeIds.add(edge.target);
                }
              }
            }
          }

          const stepDuration = Math.round(performance.now() - stepStartTime);

          // Register output into execution context for downstream nodes
          if (context.steps) {
            context.steps[nodeId] = {
              output: stepOutput,
              status: "SUCCESS",
            };
          }

          await recordStepExecution({
            executionId: job.executionId,
            nodeId,
            nodeType,
            status: "SUCCESS",
            inputData: resolvedConfig,
            outputData: stepOutput,
            durationMs: stepDuration,
          });
        } catch (stepErr) {
          const stepDuration = Math.round(performance.now() - stepStartTime);
          const errorMsg =
            stepErr instanceof Error ? stepErr.message : "Step execution failed";

          if (context.steps) {
            context.steps[nodeId] = {
              status: "FAILED",
              error: errorMsg,
            };
          }

          await recordStepExecution({
            executionId: job.executionId,
            nodeId,
            nodeType,
            status: "FAILED",
            errorMessage: errorMsg,
            durationMs: stepDuration,
          });

          // Mark downstream nodes as skipped
          for (const edge of job.edges) {
            if (edge.source === nodeId) {
              skippedNodeIds.add(edge.target);
            }
          }
        }
      }
    }

    const totalDuration = Math.round(performance.now() - startTime);
    await updateWorkflowExecutionStatus(job.executionId, "SUCCESS", totalDuration);

    return {
      success: true,
      durationMs: totalDuration,
    };
  } catch (err) {
    const totalDuration = Math.round(performance.now() - startTime);
    const errorMsg = err instanceof Error ? err.message : "DAG execution encountered a fatal error";
    await updateWorkflowExecutionStatus(job.executionId, "FAILED", totalDuration);

    return {
      success: false,
      durationMs: totalDuration,
      error: errorMsg,
    };
  }
}

/**
 * Dispatches an external HTTP request with timeout protection and status capture.
 */
async function executeHttpAction(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(config.url || "");
  const method = String(config.method || "GET").toUpperCase();
  const timeoutMs = typeof config.timeout === "number" ? config.timeout : 8000;

  if (!url || !url.startsWith("http")) {
    throw new Error(`Invalid HTTP action target URL: ${url}`);
  }

  // Anti-SSRF Defense: Block access to local/private CIDR and metadata services
  const ssrfCheck = validateSafeUrl(url);
  if (!ssrfCheck.isSafe) {
    throw new Error(`Anti-SSRF Security Alert: ${ssrfCheck.reason}`);
  }

  let headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (typeof config.headers === "string") {
    try {
      headers = { ...headers, ...JSON.parse(config.headers) };
    } catch {
      // Ignore parse failure, use defaults
    }
  } else if (typeof config.headers === "object" && config.headers !== null) {
    headers = { ...headers, ...(config.headers as Record<string, string>) };
  }

  let body: string | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (typeof config.body === "string") {
      body = config.body;
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    } else if (config.body !== undefined && config.body !== null) {
      body = JSON.stringify(config.body);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let responseData: unknown = null;
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }
    } else {
      responseData = await res.text();
    }

    return {
      status: res.status,
      ok: res.ok,
      statusText: res.statusText,
      data: responseData,
    };
  } catch (fetchErr) {
    clearTimeout(timeout);
    if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw fetchErr;
  }
}

/**
 * Evaluates boolean conditions against dynamic context values.
 */
function evaluateFilterGate(config: Record<string, unknown>): {
  matched: boolean;
  fieldValue: unknown;
  operator: string;
  targetValue: unknown;
} {
  const fieldValue = config.field;
  const operator = String(config.operator || "equals");
  const targetValue = config.value;

  let matched = false;

  switch (operator) {
    case "equals":
      matched = String(fieldValue) === String(targetValue);
      break;
    case "notEquals":
      matched = String(fieldValue) !== String(targetValue);
      break;
    case "contains":
      matched = String(fieldValue ?? "")
        .toLowerCase()
        .includes(String(targetValue ?? "").toLowerCase());
      break;
    case "greaterThan":
      matched = Number(fieldValue) > Number(targetValue);
      break;
    case "lessThan":
      matched = Number(fieldValue) < Number(targetValue);
      break;
    case "exists":
      matched =
        fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== "";
      break;
    default:
      matched = Boolean(fieldValue);
  }

  return {
    matched,
    fieldValue,
    operator,
    targetValue,
  };
}
