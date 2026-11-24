import { Queue } from "bullmq";
import { getRedisOptions, checkRedisHealth } from "./redis";
import { ExecutionJobData, executeDAGWorkflow } from "./workflow-executor";
import { logger } from "@/lib/logger";

export const QUEUE_NAME = "enterprise-dag-execution";

let workflowQueue: Queue<ExecutionJobData> | null = null;

export function getWorkflowQueue(): Queue<ExecutionJobData> | null {
  try {
    if (!workflowQueue) {
      workflowQueue = new Queue<ExecutionJobData>(QUEUE_NAME, {
        connection: getRedisOptions(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      });
    }
    return workflowQueue;
  } catch {
    return null;
  }
}

/**
 * Enqueues a DAG execution job asynchronously.
 * Dispatches to BullMQ if Redis is healthy, otherwise runs in background microtask
 * so callers (like Webhook HTTP POST handlers) return 202 Accepted immediately without blocking.
 */
export async function enqueueWorkflowJob(jobData: ExecutionJobData): Promise<{
  queued: boolean;
  mode: "bullmq" | "in-memory-worker";
  jobId: string;
}> {
  const isRedisHealthy = await checkRedisHealth();

  if (isRedisHealthy) {
    try {
      const queue = getWorkflowQueue();
      if (queue) {
        const job = await queue.add("execute-dag", jobData, {
          jobId: jobData.executionId,
        });

        return {
          queued: true,
          mode: "bullmq",
          jobId: job.id || jobData.executionId,
        };
      }
    } catch (err) {
      logger.warn("BullMQ enqueue failed; running the job in-process", { executionId: jobData.executionId, err });
    }
  }

  // Non-blocking in-memory execution via microtask
  setImmediate(() => {
    executeDAGWorkflow(jobData).catch((err) => {
      logger.error("In-process execution crashed", { executionId: jobData.executionId, err });
    });
  });

  return {
    queued: true,
    mode: "in-memory-worker",
    jobId: jobData.executionId,
  };
}

/** Jobs waiting or delayed in BullMQ (null when the queue is unavailable). */
export async function getQueueDepth(): Promise<number | null> {
  try {
    const queue = getWorkflowQueue();
    if (!queue) return null;
    const counts = await Promise.race([
      queue.getJobCounts("waiting", "delayed", "active"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000)),
    ]);
    return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
  } catch {
    return null;
  }
}
