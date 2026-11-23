import { NextRequest, NextResponse } from "next/server";
import {
  getExecutionForWorkspace,
  getWorkflowExecution,
  executionEventEmitter,
  type ExecutionEventPayload,
} from "@/lib/services/execution-service";
import { ensureExecutionEventBridge } from "@/lib/queue/execution-events";
import { checkRedisHealth } from "@/lib/queue/redis";
import { apiSession } from "@/lib/http/api-auth";

interface RouteParams {
  params: Promise<{ id: string; execId: string }>;
}

export const dynamic = "force-dynamic";

const TERMINAL = new Set(["SUCCESS", "FAILED"]);
const MAX_STREAM_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await apiSession("execution:view");
  if (session instanceof NextResponse) return session;

  const { id, execId } = await params;
  const initialExecution = await getExecutionForWorkspace(execId, session.workspaceId);
  if (!initialExecution || initialExecution.workflowId !== id) {
    return NextResponse.json({ error: `Execution ${execId} not found.` }, { status: 404 });
  }

  // Receive events from the standalone worker process (Redis pub/sub), if any.
  if (await checkRedisHealth()) await ensureExecutionEventBridge();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const finish = (status: string) => {
        send("completed", { status });
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Safety net for missed events (e.g. no Redis between worker and web): poll the record.
      const sentSteps = new Set(initialExecution.steps.map((s) => s.id));

      const eventChannel = `exec:${execId}`;
      const onEvent = (payload: ExecutionEventPayload) => {
        if (payload.type === "completed") {
          finish(String((payload.data as { status?: string })?.status ?? "SUCCESS"));
          return;
        }
        if (payload.type === "step_recorded") {
          const stepId = (payload.data as { id?: string })?.id;
          if (stepId) {
            if (sentSteps.has(stepId)) return;
            sentSteps.add(stepId);
          }
        }
        send(payload.type, payload.data);
      };
      const poll = setInterval(async () => {
        const latest = await getWorkflowExecution(execId).catch(() => null);
        if (!latest) return;
        for (const step of latest.steps) {
          if (!sentSteps.has(step.id)) {
            sentSteps.add(step.id);
            send("step_recorded", step);
          }
        }
        if (TERMINAL.has(latest.status)) finish(latest.status);
      }, 3000);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);
      const hardStop = setTimeout(() => finish("TIMEOUT"), MAX_STREAM_MS);

      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        clearTimeout(hardStop);
        executionEventEmitter.off(eventChannel, onEvent);
      }

      executionEventEmitter.on(eventChannel, onEvent);
      send("init", initialExecution);
      if (TERMINAL.has(initialExecution.status)) finish(initialExecution.status);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
