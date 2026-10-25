import { NextRequest, NextResponse } from "next/server";
import { getWorkflowByWebhookPath } from "@/lib/services/workflow-service";
import { createWorkflowExecution } from "@/lib/services/execution-service";
import { enqueueWorkflowJob } from "@/lib/queue/workflow-queue";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { verifyStripeSignature, verifyGithubSignature } from "@/lib/security/webhook-signatures";

interface RouteParams {
  params: Promise<{ path: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  if (!path) {
    return NextResponse.json(
      { error: "Webhook path slug is required." },
      { status: 400 }
    );
  }

  // Rate Limiting (Token Bucket per IP)
  const clientIp = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = checkRateLimit(`wh:${clientIp}`, { maxRequests: 120, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many webhook requests. Please throttle your dispatch rate." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 1. Locate Workflow by webhook path
  const workflow = await getWorkflowByWebhookPath(path);
  if (!workflow) {
    return NextResponse.json(
      {
        error: `No workflow registered for webhook path '/api/workflows/wh/${path}'`,
      },
      { status: 404 }
    );
  }

  if (workflow.status === "DISABLED") {
    return NextResponse.json(
      { error: "Workflow is currently disabled." },
      { status: 403 }
    );
  }

  // 2. Validate optional secret header if configured on the webhook node
  const webhookNode = workflow.nodes.find((n) => n.data.type === "webhook");
  if (webhookNode) {
    const requiredSecretHeader = webhookNode.data.config.secretHeader;
    if (
      typeof requiredSecretHeader === "string" &&
      requiredSecretHeader.trim().length > 0
    ) {
      const authHeaderValue = request.headers.get("x-webhook-secret") ||
        request.headers.get("authorization") ||
        request.headers.get(requiredSecretHeader.toLowerCase());

      if (!authHeaderValue || !authHeaderValue.includes(requiredSecretHeader)) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing webhook secret header." },
          { status: 401 }
        );
      }
    }
  }

  // 3. Extract payload data
  let parsedBody: Record<string, unknown> = {};
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      parsedBody = (await request.json()) as Record<string, unknown>;
    } else {
      const text = await request.text();
      parsedBody = { rawText: text };
    }
  } catch {
    parsedBody = {};
  }

  // Extract query parameters
  const searchParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((val, key) => {
    searchParams[key] = val;
  });

  const triggerPayload = {
    ...parsedBody,
    _meta: {
      query: searchParams,
      path,
      method: "POST",
      ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
      receivedAt: new Date().toISOString(),
    },
  };

  // 4. Create Pending Execution Record
  const execution = await createWorkflowExecution(workflow.id, triggerPayload);

  // 5. Enqueue Job to BullMQ (Non-blocking)
  await enqueueWorkflowJob({
    executionId: execution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
    triggerPayload,
  });

  // 6. Return 202 Accepted immediately without blocking the caller
  return NextResponse.json(
    {
      accepted: true,
      status: "Accepted",
      message: "Webhook event accepted and enqueued for DAG processing.",
      executionId: execution.id,
      workflowId: workflow.id,
      timestamp: Date.now(),
    },
    { status: 202 }
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const workflow = await getWorkflowByWebhookPath(path);

  if (!workflow) {
    return NextResponse.json(
      { error: `Webhook endpoint '/api/workflows/wh/${path}' not found.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "Active",
    path,
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowStatus: workflow.status,
    message: "Send HTTP POST requests with JSON payload to trigger this DAG pipeline.",
  });
}
