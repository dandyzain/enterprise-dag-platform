import type { DAGNode, DAGEdge, WorkflowNodeType, ExecutionState } from "@/lib/dag/types";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { interpolateVariables, type ExecutionContext } from "@/lib/dag/variable-interpolator";
import {
  updateWorkflowExecutionStatus,
  recordStepExecution,
  resetExecutionSteps,
} from "@/lib/services/execution-service";
import { extractCredentialReferences, getCredentialSecrets } from "@/lib/services/credential-service";
import { safeFetch } from "@/lib/security/safe-fetch";
import { TIER_LIMITS, type WorkspaceTier } from "@/lib/auth/rbac";
import { evaluateFilter } from "@/lib/dag/filter";
import { logger } from "@/lib/logger";

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  workflowName: string;
  workspaceId?: string | null;
  workspaceTier?: WorkspaceTier;
  /** Overrides the tier's run-time limit (tests, internal tooling). */
  maxDurationMs?: number;
  nodes: DAGNode[];
  edges: DAGEdge[];
  triggerPayload: Record<string, unknown>;
}

export interface ExecutionResult {
  /** True when every step succeeded or was skipped by a filter. */
  success: boolean;
  status: Extract<ExecutionState, "SUCCESS" | "FAILED">;
  durationMs: number;
  error?: string;
  /** True when the engine itself failed (worth a queue retry), not a step. */
  fatal?: boolean;
}

/** A step failure that still carries the step's output (e.g. an HTTP 500 body). */
class StepError extends Error {
  constructor(
    message: string,
    public readonly output?: unknown
  ) {
    super(message);
    this.name = "StepError";
  }
}

const DEFAULT_DEADLINE_MS = 60_000;
const MAX_DELAY_MS = 30_000;
const MAX_HTTP_TIMEOUT_MS = 30_000;
const REDACTED = "••••••••";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Execution aborted"));
      },
      { once: true }
    );
  });
}

/** Replaces every occurrence of a vault secret in logged data so audit rows never hold plaintext secrets. */
export function redactSecrets<T>(value: T, secrets: string[]): T {
  const active = secrets.filter((s) => typeof s === "string" && s.length >= 4).sort((a, b) => b.length - a.length);
  if (active.length === 0) return value;
  const visit = (v: unknown): unknown => {
    if (typeof v === "string") {
      let out = v;
      for (const s of active) if (out.includes(s)) out = out.split(s).join(REDACTED);
      return out;
    }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, visit(val)]));
    }
    return v;
  };
  return visit(value) as T;
}

function parseHeaders(raw: unknown): Record<string, string> {
  let source: unknown = raw;
  if (typeof raw === "string") {
    try {
      source = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    // Header names/values must not contain CR/LF (header injection).
    const key = k.trim();
    const value = String(v).replace(/[\r\n]+/g, " ");
    if (/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)) out[key] = value;
  }
  return out;
}

async function executeHttpAction(
  config: Record<string, unknown>,
  signal: AbortSignal,
  remainingMs: number
): Promise<Record<string, unknown>> {
  const url = String(config.url || "").trim();
  const method = String(config.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }
  if (!/^https?:\/\//i.test(url)) throw new Error(`Invalid HTTP action target URL: ${url || "(empty)"}`);

  const requested = typeof config.timeout === "number" ? config.timeout : 8_000;
  const timeoutMs = Math.max(500, Math.min(requested, MAX_HTTP_TIMEOUT_MS, remainingMs));

  const headers: Record<string, string> = { Accept: "application/json", ...parseHeaders(config.headers) };
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD" && config.body !== undefined && config.body !== null && config.body !== "") {
    body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
  }

  const res = await safeFetch(url, { method, headers, body, timeoutMs, signal });
  const output = { status: res.status, ok: res.ok, statusText: res.statusText, data: res.data };

  if (!res.ok && config.failOnHttpError !== false) {
    throw new StepError(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""} from ${new URL(url).host}`, output);
  }
  return output;
}

function parseTemplate(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Core DAG Workflow Execution Engine.
 *
 * Runs nodes tier by tier (Kahn batches); nodes in the same tier run
 * concurrently. A node runs only when every parent succeeded (AND-join);
 * otherwise it is recorded as SKIPPED. The run is FAILED when any step failed
 * or the workspace's execution time limit was hit.
 */
export async function executeDAGWorkflow(job: ExecutionJobData): Promise<ExecutionResult> {
  const startTime = performance.now();
  const deadlineMs =
    job.maxDurationMs ??
    (job.workspaceTier && TIER_LIMITS[job.workspaceTier] ? TIER_LIMITS[job.workspaceTier].maxExecutionDurationMs : DEFAULT_DEADLINE_MS);
  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(new Error(`Execution time limit of ${Math.round(deadlineMs / 1000)}s exceeded`)),
    deadlineMs
  );

  let secrets: string[] = [];

  try {
    // Queue retries re-run an execution: start from a clean slate.
    await resetExecutionSteps(job.executionId);
    await updateWorkflowExecutionStatus(job.executionId, "RUNNING");

    // Only decrypt credentials the workflow actually references, scoped to its workspace.
    const references = extractCredentialReferences(job.nodes.map((n) => n.data?.config));
    const credentials = job.workspaceId && references.length > 0 ? await getCredentialSecrets(job.workspaceId, references) : {};
    secrets = Object.values(credentials);

    const context: ExecutionContext = {
      trigger: { body: job.triggerPayload, timestamp: Date.now() },
      steps: {},
      credentials,
    };

    const { executionBatches } = getTopologicalOrder(job.nodes, job.edges);
    const nodeMap = new Map(job.nodes.map((n) => [n.id, n]));
    const children = new Map<string, string[]>();
    for (const edge of job.edges) {
      if (!children.has(edge.source)) children.set(edge.source, []);
      children.get(edge.source)!.push(edge.target);
    }

    const blocked = new Map<string, string>();
    const block = (nodeId: string, reason: string) => {
      for (const child of children.get(nodeId) ?? []) if (!blocked.has(child)) blocked.set(child, reason);
    };
    let failedSteps = 0;

    const runNode = async (nodeId: string): Promise<void> => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const nodeType = (node.data?.type || "action") as WorkflowNodeType;

      const blockedReason = blocked.get(nodeId);
      if (blockedReason) {
        await recordStepExecution({
          executionId: job.executionId,
          nodeId,
          nodeType,
          status: "SKIPPED",
          errorMessage: blockedReason,
          durationMs: 0,
        });
        block(nodeId, blockedReason);
        return;
      }

      const stepStart = performance.now();
      let resolvedConfig: Record<string, unknown> = {};
      try {
        if (controller.signal.aborted) throw controller.signal.reason;
        resolvedConfig = interpolateVariables(node.data?.config || {}, context) as Record<string, unknown>;
        const remainingMs = Math.max(0, deadlineMs - (performance.now() - startTime));

        let stepOutput: unknown = null;
        switch (nodeType) {
          case "trigger":
          case "webhook":
            stepOutput = { success: true, payload: job.triggerPayload };
            break;
          case "schedule":
            stepOutput = { success: true, firedAt: new Date().toISOString(), cron: resolvedConfig.cron ?? null, payload: job.triggerPayload };
            break;
          case "action":
            stepOutput = await executeHttpAction(resolvedConfig, controller.signal, remainingMs);
            break;
          case "transform":
            stepOutput = interpolateVariables(parseTemplate(node.data?.config?.template), context);
            break;
          case "delay": {
            const requested = Number(resolvedConfig.durationMs ?? 1000);
            // Not clamped to the remaining budget: a delay that outlives the run's time
            // limit is aborted by the deadline and fails the step explicitly.
            const waitMs = Math.max(0, Math.min(Number.isFinite(requested) ? requested : 0, MAX_DELAY_MS));
            await sleep(waitMs, controller.signal);
            stepOutput = { waitedMs: waitMs };
            break;
          }
          case "filter": {
            const result = evaluateFilter(resolvedConfig);
            stepOutput = result;
            if (!result.matched) block(nodeId, "Skipped: Upstream conditional filter evaluated to false");
            break;
          }
          default:
            throw new Error(`Unknown step type: ${nodeType}`);
        }

        context.steps![nodeId] = { output: stepOutput, status: "SUCCESS" };
        await recordStepExecution({
          executionId: job.executionId,
          nodeId,
          nodeType,
          status: "SUCCESS",
          inputData: redactSecrets(resolvedConfig, secrets),
          outputData: redactSecrets(stepOutput, secrets),
          durationMs: Math.round(performance.now() - stepStart),
        });
      } catch (stepErr) {
        failedSteps++;
        const errorMsg = redactSecrets(stepErr instanceof Error ? stepErr.message : "Step execution failed", secrets);
        context.steps![nodeId] = { status: "FAILED", error: errorMsg };
        await recordStepExecution({
          executionId: job.executionId,
          nodeId,
          nodeType,
          status: "FAILED",
          inputData: redactSecrets(resolvedConfig, secrets),
          outputData: stepErr instanceof StepError ? redactSecrets(stepErr.output, secrets) : undefined,
          errorMessage: errorMsg,
          durationMs: Math.round(performance.now() - stepStart),
        });
        block(nodeId, "Skipped: Upstream step failed");
      }
    };

    for (const batch of executionBatches) {
      await Promise.all(batch.map((nodeId) => runNode(nodeId)));
    }

    const totalDuration = Math.round(performance.now() - startTime);
    const timedOut = controller.signal.aborted;
    const status = failedSteps > 0 || timedOut ? "FAILED" : "SUCCESS";
    await updateWorkflowExecutionStatus(job.executionId, status, totalDuration);

    return {
      success: status === "SUCCESS",
      status,
      durationMs: totalDuration,
      error: timedOut
        ? String((controller.signal.reason as Error)?.message ?? "Execution time limit exceeded")
        : failedSteps > 0
          ? `${failedSteps} step(s) failed`
          : undefined,
    };
  } catch (err) {
    const totalDuration = Math.round(performance.now() - startTime);
    const errorMsg = redactSecrets(err instanceof Error ? err.message : "DAG execution encountered a fatal error", secrets);
    logger.error("DAG execution failed", { executionId: job.executionId, workflowId: job.workflowId, error: errorMsg });
    try {
      await updateWorkflowExecutionStatus(job.executionId, "FAILED", totalDuration);
    } catch {
      // Storage itself is failing; the queue retry (if any) will try again.
    }
    return { success: false, status: "FAILED", durationMs: totalDuration, error: errorMsg, fatal: true };
  } finally {
    clearTimeout(deadline);
  }
}
