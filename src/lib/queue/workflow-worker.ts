import { Worker, Job } from "bullmq";
import { getRedisOptions } from "./redis";
import { QUEUE_NAME } from "./workflow-queue";
import { ExecutionJobData, executeDAGWorkflow } from "./workflow-executor";
import { logger } from "@/lib/logger";

let workerInstance: Worker<ExecutionJobData> | null = null;

export function startWorkflowWorker(): Worker<ExecutionJobData> | null {
  try {
    if (!workerInstance) {
      workerInstance = new Worker<ExecutionJobData>(
        QUEUE_NAME,
        async (job: Job<ExecutionJobData>) => {
          logger.info("Processing execution job", { jobId: job.id, workflowId: job.data.workflowId, attempt: job.attemptsMade + 1 });
          const result = await executeDAGWorkflow(job.data);
          // Step failures are part of the run's result and must not be retried
          // (HTTP actions are not idempotent). Only engine/storage failures retry.
          if (result.fatal) {
            throw new Error(result.error || "DAG execution failed");
          }
          return result;
        },
        {
          connection: getRedisOptions(),
          concurrency: 5,
        }
      );

      workerInstance.on("completed", (job, result) => {
        logger.info("Execution job finished", { jobId: job.id, status: (result as { status?: string })?.status });
      });

      workerInstance.on("failed", (job, err) => {
        logger.error("Execution job failed", { jobId: job?.id, err });
      });
    }

    return workerInstance;
  } catch (err) {
    logger.warn("Could not start BullMQ worker", { err });
    return null;
  }
}
