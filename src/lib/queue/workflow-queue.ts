import { Queue } from "bullmq";
import { getRedisOptions, checkRedisHealth } from "./redis";
import { ExecutionJobData, executeDAGWorkflow } from "./workflow-executor";

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
          removeOnComplete: true,
          removeOnFail: false,
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
    } catch {
      // Redis error during add, fall back to async worker
    }
  }

  // Non-blocking in-memory execution via microtask
  setImmediate(() => {
    executeDAGWorkflow(jobData).catch((err) => {
      console.error("[In-Memory Worker] Background execution error:", err);
    });
  });

  return {
    queued: true,
    mode: "in-memory-worker",
    jobId: jobData.executionId,
  };
}
