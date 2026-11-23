import { startWorkflowWorker } from "../src/lib/queue/workflow-worker";
import { startScheduler, stopScheduler } from "../src/lib/queue/scheduler";
import { checkRedisHealth } from "../src/lib/queue/redis";
import { isSchedulerEnabled } from "../src/lib/config/env";
import { logger } from "../src/lib/logger";

async function main() {
  const redisUp = await checkRedisHealth();
  const worker = redisUp ? startWorkflowWorker() : null;

  if (!worker) {
    logger.warn("Redis is unreachable; the queue worker is idle (the web process runs jobs in-process).");
  } else {
    logger.info("BullMQ worker is listening for execution jobs", { concurrency: 5 });
  }

  if (isSchedulerEnabled()) startScheduler();

  async function handleShutdown(signal: string) {
    logger.info("Shutting down worker", { signal });
    stopScheduler();
    if (worker) await worker.close();
    process.exit(0);
  }

  process.on("SIGINT", () => void handleShutdown("SIGINT"));
  process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Worker failed to start", { err });
  process.exit(1);
});
