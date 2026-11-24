"use server";

import type { WorkflowNodeType } from "@/lib/dag/types";
import { interpolateVariables, type ExecutionContext } from "@/lib/dag/variable-interpolator";
import { evaluateFilter } from "@/lib/dag/filter";
import { nextCronRun, validateCron } from "@/lib/dag/cron";
import { extractCredentialReferences, getCredentialSecrets } from "@/lib/services/credential-service";
import { redactSecrets } from "@/lib/queue/workflow-executor";
import { safeFetch } from "@/lib/security/safe-fetch";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { requirePermission, AuthError } from "@/lib/auth/guards";

export interface StepTestResult {
  success: boolean;
  durationMs: number;
  data?: unknown;
  error?: string;
  statusCode?: number;
}

const SAMPLE_TRIGGER = {
  customerId: "cust_9824",
  email: "jane.doe@enterprise.io",
  tier: "enterprise",
  amount: 250.0,
  status: "active",
};

/**
 * Runs one step in isolation from the inspector. Requires `workflow:execute`
 * in the active workspace; vault secrets are resolved from that workspace
 * only and are redacted from everything returned to the browser.
 */
export async function testSingleStepAction(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
  customPayload?: Record<string, unknown>
): Promise<StepTestResult> {
  const startTime = performance.now();
  const elapsed = () => Math.round(performance.now() - startTime);

  let session;
  try {
    session = await requirePermission("workflow:execute");
  } catch (err) {
    if (err instanceof AuthError) return { success: false, durationMs: 0, error: err.message };
    throw err;
  }

  const limit = checkRateLimit(`step-test:${session.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return { success: false, durationMs: 0, error: "Too many test runs. Please wait a moment and try again." };
  }

  const credentials = await getCredentialSecrets(session.workspaceId, extractCredentialReferences(config));
  const secrets = Object.values(credentials);

  const context: ExecutionContext = {
    trigger: {
      body: customPayload && typeof customPayload === "object" ? customPayload : SAMPLE_TRIGGER,
      headers: { "x-test-event": "manual_inspection" },
    },
    steps: {
      step_sample: { output: { data: { id: "sample_record_123", status: "success", score: 98 } }, status: "SUCCESS" },
    },
    credentials,
  };

  const done = (result: Omit<StepTestResult, "durationMs">): StepTestResult =>
    redactSecrets({ ...result, durationMs: elapsed() }, secrets);

  try {
    const resolvedConfig = interpolateVariables(config, context) as Record<string, unknown>;

    switch (nodeType) {
      case "trigger": {
        let parsed = resolvedConfig.payload;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // keep as string
          }
        }
        return done({ success: true, data: parsed });
      }
      case "webhook": {
        const path = String(resolvedConfig.path || "wh-sample");
        return done({
          success: true,
          data: { endpoint: `/api/workflows/wh/${path}`, method: "POST", status: "Ready for inbound traffic", samplePayload: context.trigger?.body },
        });
      }
      case "schedule": {
        const cron = String(resolvedConfig.cron || "").trim();
        const err = validateCron(cron);
        if (err) return done({ success: false, error: err });
        const runs: string[] = [];
        let cursor = new Date();
        for (let i = 0; i < 5; i++) {
          const next = nextCronRun(cron, cursor);
          if (!next) break;
          runs.push(next.toISOString());
          cursor = next;
        }
        return done({ success: true, data: { cron, timezone: "UTC", nextRuns: runs } });
      }
      case "filter":
        return done({ success: true, data: evaluateFilter(resolvedConfig) });
      case "transform": {
        let template: unknown = config.template;
        if (typeof template === "string") {
          try {
            template = JSON.parse(template);
          } catch {
            // plain string template
          }
        }
        return done({ success: true, data: interpolateVariables(template ?? {}, context) });
      }
      case "delay": {
        const ms = Math.max(0, Math.min(Number(resolvedConfig.durationMs ?? 0) || 0, 30_000));
        return done({ success: true, data: { wouldWaitMs: ms, note: "Delays are not awaited in test mode." } });
      }
      case "action": {
        const url = String(resolvedConfig.url || "");
        const method = String(resolvedConfig.method || "GET").toUpperCase();
        if (!/^https?:\/\//i.test(url)) {
          return done({ success: false, error: "Invalid target URL. Must begin with http:// or https://" });
        }

        let headers: Record<string, string> = { Accept: "application/json" };
        if (typeof resolvedConfig.headers === "string") {
          try {
            headers = { ...headers, ...JSON.parse(resolvedConfig.headers) };
          } catch {
            // ignore
          }
        } else if (resolvedConfig.headers && typeof resolvedConfig.headers === "object") {
          headers = { ...headers, ...(resolvedConfig.headers as Record<string, string>) };
        }

        let body: string | undefined;
        if (method !== "GET" && method !== "HEAD" && resolvedConfig.body !== undefined && resolvedConfig.body !== null) {
          body = typeof resolvedConfig.body === "string" ? resolvedConfig.body : JSON.stringify(resolvedConfig.body);
          if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
        }

        try {
          const res = await safeFetch(url, { method, headers, body, timeoutMs: 6_000, maxBytes: 512 * 1024 });
          return done({
            success: res.ok,
            statusCode: res.status,
            data: res.data,
            error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
          });
        } catch (fetchErr) {
          return done({ success: false, error: fetchErr instanceof Error ? fetchErr.message : "HTTP request failed" });
        }
      }
      default:
        return done({ success: true, data: resolvedConfig });
    }
  } catch (err) {
    return done({ success: false, error: err instanceof Error ? err.message : "Step test execution failed" });
  }
}
