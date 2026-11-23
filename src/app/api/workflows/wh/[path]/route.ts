import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getWorkflowByWebhookPath } from "@/lib/services/workflow-service";
import { getCredentialSecret } from "@/lib/services/credential-service";
import { dispatchWorkflowRun } from "@/lib/services/dispatch-service";
import { getCurrentSession } from "@/lib/services/auth-service";
import { hasPermission } from "@/lib/auth/rbac";
import { QuotaError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { verifyStripeSignature, verifyGithubSignature, verifyGenericHmac } from "@/lib/security/webhook-signatures";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ path: string }>;
}

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB
const PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;
const SECRET_HEADERS = ["x-webhook-secret", "x-webhook-secret-key"];
const FORWARDED_HEADER_DENYLIST = new Set([
  "authorization",
  "cookie",
  "x-webhook-secret",
  "x-webhook-secret-key",
  "stripe-signature",
  "x-hub-signature-256",
  "x-signature",
  "proxy-authorization",
]);

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function clientIp(request: NextRequest): string {
  // Left-most X-Forwarded-For entry as set by the edge proxy (Vercel/Render/Railway overwrite it).
  return (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function readBodyCapped(request: NextRequest): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  if (!path || !PATH_PATTERN.test(path)) {
    return json({ error: "Invalid webhook path." }, 400);
  }

  // 1. Rate limiting: per client IP and per endpoint (the latter cannot be bypassed by spoofing IPs).
  const ip = clientIp(request);
  const perIp = checkRateLimit(`wh:ip:${ip}`, { maxRequests: 120, windowMs: 60_000 });
  const perPath = checkRateLimit(`wh:path:${path}`, { maxRequests: 600, windowMs: 60_000 });
  if (!perIp.allowed || !perPath.allowed) {
    const reset = Math.ceil(Math.max(perIp.resetMs, perPath.resetMs) / 1000);
    return json({ error: "Too many webhook requests. Please throttle your dispatch rate." }, 429, {
      "Retry-After": String(Math.max(reset, 1)),
      "X-RateLimit-Remaining": "0",
    });
  }

  // 2. Locate the workflow
  const workflow = await getWorkflowByWebhookPath(path);
  if (!workflow) {
    return json({ error: `No workflow registered for webhook path '/api/workflows/wh/${path}'` }, 404);
  }
  if (workflow.status === "DISABLED") {
    return json({ error: "Workflow is currently disabled." }, 403);
  }
  if (workflow.status !== "PUBLISHED") {
    // Drafts only accept test deliveries from signed-in members of the owning workspace.
    const session = await getCurrentSession();
    const isTester =
      session && session.workspaceId === workflow.workspaceId && hasPermission(session.role, "workflow:execute");
    if (!isTester) {
      return json({ error: "Workflow is not published. Publish it to accept external webhook deliveries." }, 409);
    }
  }

  // 3. Body (size-capped, read once so signatures can be verified on the raw bytes)
  const rawBody = await readBodyCapped(request);
  if (rawBody === null) {
    return json({ error: `Payload too large (max ${MAX_BODY_BYTES / 1024} KiB).` }, 413);
  }

  // 4. Authentication: shared secret and/or provider signature, as configured on the webhook node
  const webhookNode = workflow.nodes.find((n) => n.data?.type === "webhook");
  const config = (webhookNode?.data?.config ?? {}) as Record<string, unknown>;

  let sharedSecret = typeof config.secretHeader === "string" ? config.secretHeader.trim() : "";
  if (typeof config.secretCredential === "string" && config.secretCredential.trim() && workflow.workspaceId) {
    sharedSecret = (await getCredentialSecret(workflow.workspaceId, config.secretCredential)) ?? "";
    if (!sharedSecret) return json({ error: "Webhook is misconfigured: secret credential not found." }, 500);
  }
  if (sharedSecret) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const provided = SECRET_HEADERS.map((h) => request.headers.get(h)?.trim()).find(Boolean) ?? bearer ?? "";
    if (!provided || !timingSafeEqualStrings(provided, sharedSecret)) {
      return json({ error: "Unauthorized: Invalid or missing webhook secret." }, 401);
    }
  }

  const provider = typeof config.signatureProvider === "string" ? config.signatureProvider : "none";
  if (provider !== "none" && provider !== "") {
    const credentialName = typeof config.signingSecretCredential === "string" ? config.signingSecretCredential : "";
    const signingSecret = credentialName && workflow.workspaceId ? await getCredentialSecret(workflow.workspaceId, credentialName) : null;
    if (!signingSecret) {
      return json({ error: "Webhook is misconfigured: signing secret credential not found." }, 500);
    }
    let verification;
    if (provider === "stripe") {
      verification = verifyStripeSignature(rawBody, request.headers.get("stripe-signature") || "", signingSecret);
    } else if (provider === "github") {
      verification = verifyGithubSignature(rawBody, request.headers.get("x-hub-signature-256") || "", signingSecret);
    } else {
      verification = verifyGenericHmac(rawBody, (request.headers.get("x-signature") || "").replace(/^sha256=/, ""), signingSecret);
    }
    if (!verification.isValid) {
      return json({ error: `Unauthorized: ${verification.error ?? "signature verification failed"}` }, 401);
    }
  }

  // 5. Parse payload
  let parsedBody: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") || "";
  if (rawBody.length > 0) {
    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(rawBody) as unknown;
        parsedBody = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { data: parsed };
      } catch {
        return json({ error: "Malformed JSON payload." }, 400);
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      parsedBody = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      parsedBody = { rawText: rawBody };
    }
  }

  const forwardedHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!FORWARDED_HEADER_DENYLIST.has(key) && !key.startsWith("x-vercel") && Object.keys(forwardedHeaders).length < 40) {
      forwardedHeaders[key] = value.slice(0, 512);
    }
  });

  const triggerPayload = {
    ...parsedBody,
    _meta: {
      query: Object.fromEntries(request.nextUrl.searchParams),
      headers: forwardedHeaders,
      path,
      method: "POST",
      ip,
      receivedAt: new Date().toISOString(),
    },
  };

  // 6. Create the execution and enqueue (non-blocking)
  try {
    const run = await dispatchWorkflowRun(workflow, triggerPayload, "webhook");
    return json(
      {
        accepted: true,
        status: "Accepted",
        message: "Webhook event accepted and enqueued for DAG processing.",
        executionId: run.executionId,
        workflowId: workflow.id,
        timestamp: Date.now(),
      },
      202
    );
  } catch (err) {
    if (err instanceof QuotaError) return json({ error: err.message }, 429);
    logger.error("Webhook dispatch failed", { path, err });
    return json({ error: "Failed to enqueue the workflow run." }, 500);
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const workflow = PATH_PATTERN.test(path) ? await getWorkflowByWebhookPath(path) : null;
  if (!workflow || workflow.status !== "PUBLISHED") {
    return json({ error: `Webhook endpoint '/api/workflows/wh/${path}' not found.` }, 404);
  }
  return json(
    { status: "Active", path, method: "POST", message: "Send HTTP POST requests with a JSON payload to trigger this workflow." },
    200
  );
}
