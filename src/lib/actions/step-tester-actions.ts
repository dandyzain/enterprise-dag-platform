"use server";

import { WorkflowNodeType } from "@/lib/dag/types";
import { interpolateVariables, ExecutionContext } from "@/lib/dag/variable-interpolator";
import { getCredentialSecret } from "@/lib/services/credential-service";
import { validateSafeUrl } from "@/lib/security/anti-ssrf";

export interface StepTestResult {
  success: boolean;
  durationMs: number;
  data?: unknown;
  error?: string;
  statusCode?: number;
}

export async function testSingleStepAction(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
  customPayload?: Record<string, unknown>
): Promise<StepTestResult> {
  const startTime = performance.now();

  // Prepare standard mock context for testing
  const context: ExecutionContext = {
    trigger: {
      body: customPayload || {
        customerId: "cust_9824",
        email: "jane.doe@enterprise.io",
        tier: "enterprise",
        amount: 250.0,
        status: "active",
      },
      headers: {
        "x-test-event": "manual_inspection",
      },
    },
    steps: {
      step_sample: {
        output: {
          data: {
            id: "sample_record_123",
            status: "success",
            score: 98,
          },
        },
        status: "SUCCESS",
      },
    },
    credentials: {
      STRIPE_PRODUCTION_API_KEY:
        (await getCredentialSecret("STRIPE_PRODUCTION_API_KEY")) || "mock_stripe_live_corp_vault_token_sample",
      INTERNAL_LEDGER_AUTH_SECRET:
        (await getCredentialSecret("INTERNAL_LEDGER_AUTH_SECRET")) || "Bearer sample_auth_ledger",
    },
  };

  try {
    const resolvedConfig = interpolateVariables(config, context) as Record<string, unknown>;

    if (nodeType === "trigger") {
      const payload = resolvedConfig.payload;
      let parsed = payload;
      if (typeof payload === "string") {
        try {
          parsed = JSON.parse(payload);
        } catch {
          // keep as string
        }
      }
      return {
        success: true,
        durationMs: Math.round(performance.now() - startTime),
        data: parsed,
      };
    }

    if (nodeType === "webhook") {
      const path = String(resolvedConfig.path || "wh-sample");
      return {
        success: true,
        durationMs: Math.round(performance.now() - startTime),
        data: {
          endpoint: `/api/workflows/wh/${path}`,
          method: "POST",
          status: "Ready for inbound traffic",
          samplePayload: context.trigger?.body,
        },
      };
    }

    if (nodeType === "filter") {
      const fieldValue = resolvedConfig.field;
      const operator = String(resolvedConfig.operator || "equals");
      const targetValue = resolvedConfig.value;

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
            fieldValue !== undefined &&
            fieldValue !== null &&
            String(fieldValue).trim() !== "";
          break;
        default:
          matched = Boolean(fieldValue);
      }

      return {
        success: true,
        durationMs: Math.round(performance.now() - startTime),
        data: {
          matched,
          evaluatedValue: fieldValue,
          operator,
          targetValue,
          explanation: matched
            ? `Filter condition passed: '${fieldValue}' ${operator} '${targetValue}'`
            : `Filter condition halted: '${fieldValue}' did not satisfy ${operator} '${targetValue}'`,
        },
      };
    }

    if (nodeType === "action") {
      const url = String(resolvedConfig.url || "");
      const method = String(resolvedConfig.method || "GET").toUpperCase();

      if (!url || !url.startsWith("http")) {
        return {
          success: false,
          durationMs: Math.round(performance.now() - startTime),
          error: "Invalid target URL. Must begin with http:// or https://",
        };
      }

      // Anti-SSRF check
      const ssrfCheck = validateSafeUrl(url);
      if (!ssrfCheck.isSafe) {
        return {
          success: false,
          durationMs: Math.round(performance.now() - startTime),
          error: `Anti-SSRF Block: ${ssrfCheck.reason}`,
        };
      }

      let headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (typeof resolvedConfig.headers === "string") {
        try {
          headers = { ...headers, ...JSON.parse(resolvedConfig.headers) };
        } catch {
          // ignore
        }
      } else if (
        typeof resolvedConfig.headers === "object" &&
        resolvedConfig.headers !== null
      ) {
        headers = { ...headers, ...(resolvedConfig.headers as Record<string, string>) };
      }

      let body: string | undefined = undefined;
      if (method !== "GET" && method !== "HEAD") {
        if (typeof resolvedConfig.body === "string") {
          body = resolvedConfig.body;
          if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        } else if (resolvedConfig.body !== undefined && resolvedConfig.body !== null) {
          body = JSON.stringify(resolvedConfig.body);
          if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const durationMs = Math.round(performance.now() - startTime);

        let responseData: unknown = null;
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            responseData = await res.json();
          } catch {
            responseData = null;
          }
        } else {
          responseData = await res.text();
        }

        return {
          success: res.ok,
          statusCode: res.status,
          durationMs,
          data: responseData,
          error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
        };
      } catch (fetchErr) {
        clearTimeout(timeout);
        const durationMs = Math.round(performance.now() - startTime);
        const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
        return {
          success: false,
          durationMs,
          error: isAbort
            ? "Request timed out after 6000ms"
            : fetchErr instanceof Error
            ? fetchErr.message
            : "HTTP request failed",
        };
      }
    }

    return {
      success: true,
      durationMs: Math.round(performance.now() - startTime),
      data: resolvedConfig,
    };
  } catch (err) {
    return {
      success: false,
      durationMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : "Step test execution failed",
    };
  }
}
