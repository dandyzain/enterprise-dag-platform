/**
 * Execution telemetry fan-out.
 *
 * Steps are recorded by whichever process runs the DAG: the web process
 * (in-memory fallback runner) or the standalone BullMQ worker. The SSE route
 * lives in the web process, so events are published locally *and* over Redis
 * pub/sub; each process re-emits events from other processes on its local
 * EventEmitter. Without Redis everything is single-process and the local
 * emitter alone is enough.
 */
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import type Redis from "ioredis";
import { getRedisConnection, isRedisReady } from "@/lib/queue/redis";
import { logger } from "@/lib/logger";

export interface ExecutionEventPayload {
  executionId: string;
  type: "status_changed" | "step_recorded" | "completed";
  data: unknown;
}

const CHANNEL = "nexusflow:execution-events";

const globalForEvents = globalThis as unknown as {
  __nfExecEmitter?: EventEmitter;
  __nfExecBridge?: { origin: string; subscriber: Redis | null; starting: boolean };
};

export const executionEventEmitter: EventEmitter =
  globalForEvents.__nfExecEmitter ?? (globalForEvents.__nfExecEmitter = new EventEmitter());
executionEventEmitter.setMaxListeners(500);

const bridge =
  globalForEvents.__nfExecBridge ??
  (globalForEvents.__nfExecBridge = { origin: crypto.randomUUID(), subscriber: null, starting: false });

export function publishExecutionEvent(payload: ExecutionEventPayload): void {
  executionEventEmitter.emit(`exec:${payload.executionId}`, payload);

  if (!isRedisReady()) return;
  try {
    getRedisConnection()
      .publish(CHANNEL, JSON.stringify({ origin: bridge.origin, payload }))
      .catch(() => undefined);
  } catch {
    // Redis went away between the check and the publish; local delivery already happened.
  }
}

/** Subscribes this process to events published by other processes (idempotent). */
export async function ensureExecutionEventBridge(): Promise<void> {
  if (bridge.subscriber || bridge.starting || !isRedisReady()) return;
  bridge.starting = true;
  try {
    const subscriber = getRedisConnection().duplicate();
    subscriber.on("error", () => undefined);
    subscriber.on("end", () => {
      if (bridge.subscriber === subscriber) bridge.subscriber = null;
    });
    subscriber.on("message", (_channel: string, raw: string) => {
      try {
        const msg = JSON.parse(raw) as { origin: string; payload: ExecutionEventPayload };
        if (msg.origin === bridge.origin) return;
        executionEventEmitter.emit(`exec:${msg.payload.executionId}`, msg.payload);
      } catch {
        // ignore malformed messages
      }
    });
    await subscriber.subscribe(CHANNEL);
    bridge.subscriber = subscriber;
  } catch (err) {
    logger.warn("Execution event bridge unavailable; live updates limited to this process", { err });
  } finally {
    bridge.starting = false;
  }
}
