/**
 * Cron scheduler for workflows that start with a "schedule" trigger, plus the
 * daily execution-retention job.
 *
 * Runs inside long-lived processes (the BullMQ worker and/or the Next.js
 * server via instrumentation). Every firing is claimed with a Redis
 * `SET NX` lock keyed by workflow + minute, so several processes can run the
 * scheduler without double-firing. Serverless deployments call
 * `/api/cron/tick` instead.
 */
import { parseCron, cronMatches } from "@/lib/dag/cron";
import { listScheduledWorkflows } from "@/lib/services/workflow-service";
import { dispatchWorkflowRun } from "@/lib/services/dispatch-service";
import { pruneAllWorkspaces } from "@/lib/services/retention-service";
import { getRedisConnection, isRedisReady, checkRedisHealth } from "@/lib/queue/redis";
import { logger } from "@/lib/logger";

const RETENTION_HOUR_UTC = 3;

const globalForScheduler = globalThis as unknown as {
  __nfScheduler?: { timer: NodeJS.Timeout | null; lastMinute: string | null; localLocks: Map<string, number> };
};
const state =
  globalForScheduler.__nfScheduler ??
  (globalForScheduler.__nfScheduler = { timer: null, lastMinute: null, localLocks: new Map() });

function minuteKey(date: Date): string {
  return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

async function claim(lockKey: string, ttlSeconds: number): Promise<boolean> {
  if (isRedisReady()) {
    try {
      const res = await getRedisConnection().set(`nexusflow:lock:${lockKey}`, "1", "EX", ttlSeconds, "NX");
      return res === "OK";
    } catch {
      // fall through to the local lock
    }
  }
  const now = Date.now();
  for (const [key, expires] of state.localLocks) if (expires < now) state.localLocks.delete(key);
  if (state.localLocks.has(lockKey)) return false;
  state.localLocks.set(lockKey, now + ttlSeconds * 1000);
  return true;
}

export interface TickResult {
  minute: string;
  fired: { workflowId: string; executionId?: string; error?: string }[];
  retention: boolean;
}

/** Evaluates all schedules for the minute containing `now`. Safe to call repeatedly. */
export async function runSchedulerTick(now = new Date()): Promise<TickResult> {
  const minute = minuteKey(now);
  const result: TickResult = { minute, fired: [], retention: false };
  await checkRedisHealth();

  let workflows;
  try {
    workflows = await listScheduledWorkflows();
  } catch (err) {
    logger.warn("Scheduler could not list workflows", { err });
    return result;
  }

  for (const wf of workflows) {
    const scheduleNode = wf.nodes.find((n) => n.data?.type === "schedule");
    const cron = String(scheduleNode?.data?.config?.cron ?? "").trim();
    if (!cron) continue;

    let matches = false;
    try {
      matches = cronMatches(parseCron(cron), now);
    } catch {
      continue; // invalid expressions are rejected on save; ignore legacy rows
    }
    if (!matches) continue;
    if (!(await claim(`schedule:${wf.id}:${minute}`, 120))) continue;

    try {
      const run = await dispatchWorkflowRun(
        wf,
        { scheduledFor: `${minute}:00.000Z`, cron, ...((scheduleNode?.data?.config?.payload as object) ?? {}) },
        "schedule"
      );
      result.fired.push({ workflowId: wf.id, executionId: run.executionId });
      logger.info("Scheduled workflow fired", { workflowId: wf.id, executionId: run.executionId, cron });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.fired.push({ workflowId: wf.id, error: message });
      logger.warn("Scheduled workflow could not start", { workflowId: wf.id, error: message });
    }
  }

  if (now.getUTCHours() === RETENTION_HOUR_UTC && now.getUTCMinutes() === 17) {
    if (await claim(`retention:${minute.slice(0, 10)}`, 26 * 3600)) {
      await pruneAllWorkspaces();
      result.retention = true;
    }
  }

  return result;
}

export function startScheduler(): void {
  if (state.timer) return;
  const tick = () => {
    const now = new Date();
    const key = minuteKey(now);
    if (key === state.lastMinute) return;
    state.lastMinute = key;
    runSchedulerTick(now).catch((err) => logger.error("Scheduler tick failed", { err }));
  };
  state.timer = setInterval(tick, 15_000);
  state.timer.unref?.();
  logger.info("Workflow scheduler started");
  tick();
}

export function stopScheduler(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}
