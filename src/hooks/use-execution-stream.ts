"use client";

import { useCallback, useEffect, useRef } from "react";

export interface StreamStep {
  id?: string;
  nodeId: string;
  nodeType?: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  durationMs?: number | null;
  errorMessage?: string | null;
  outputData?: unknown;
  workflowExecutionId?: string;
}

interface StreamHandlers {
  onStep?: (step: StreamStep) => void;
  onComplete?: (status: string) => void;
  onError?: () => void;
}

/**
 * Wraps the existing SSE endpoint
 *   GET /api/workflows/:id/executions/:execId/stream
 * (events: `step_recorded`, `completed`). Exactly one stream is open at a time
 * and it is always closed on completion, error, restart or unmount.
 */
export function useExecutionStream() {
  const sourceRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = useCallback(
    (workflowId: string, executionId: string, handlers: StreamHandlers) => {
      stop();
      const source = new EventSource(`/api/workflows/${workflowId}/executions/${executionId}/stream`);
      sourceRef.current = source;

      source.addEventListener("step_recorded", (e) => {
        try {
          handlers.onStep?.(JSON.parse((e as MessageEvent).data) as StreamStep);
        } catch {
          // Ignore malformed chunks.
        }
      });

      source.addEventListener("completed", (e) => {
        let status = "SUCCESS";
        try {
          status = JSON.parse((e as MessageEvent).data)?.status ?? status;
        } catch {
          // keep default
        }
        if (sourceRef.current === source) stop();
        handlers.onComplete?.(status);
      });

      source.onerror = () => {
        if (sourceRef.current === source) stop();
        handlers.onError?.();
      };
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { start, stop };
}
