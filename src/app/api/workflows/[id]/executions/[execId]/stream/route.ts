import { NextRequest } from "next/server";
import {
  getWorkflowExecution,
  executionEventEmitter,
  ExecutionEventPayload,
} from "@/lib/services/execution-service";

interface RouteParams {
  params: Promise<{ id: string; execId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { execId } = await params;
  const initialExecution = await getWorkflowExecution(execId);

  if (!initialExecution) {
    return new Response(JSON.stringify({ error: `Execution ${execId} not found.` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial snapshot
      const initChunk = `event: init\ndata: ${JSON.stringify(initialExecution)}\n\n`;
      controller.enqueue(encoder.encode(initChunk));

      // If already done, close right away
      if (
        initialExecution.status === "SUCCESS" ||
        initialExecution.status === "FAILED"
      ) {
        controller.enqueue(
          encoder.encode(
            `event: completed\ndata: ${JSON.stringify({ status: initialExecution.status })}\n\n`
          )
        );
        controller.close();
        return;
      }

      // 2. Listen for live events
      const eventChannel = `exec:${execId}`;
      const onEvent = (payload: ExecutionEventPayload) => {
        try {
          const chunk = `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));

          if (payload.type === "completed") {
            cleanup();
            controller.close();
          }
        } catch {
          cleanup();
        }
      };

      // 3. Heartbeat ping every 15s to maintain persistent HTTP connection
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);

      function cleanup() {
        clearInterval(heartbeatInterval);
        executionEventEmitter.off(eventChannel, onEvent);
      }

      executionEventEmitter.on(eventChannel, onEvent);

      // Clean up when client aborts / navigates away
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
