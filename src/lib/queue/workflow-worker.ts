import { Worker, Job } from "bullmq";
import { getRedisOptions } from "./redis";
import { QUEUE_NAME } from "./workflow-queue";
import { ExecutionJobData, executeDAGWorkflow } from "./workflow-executor";

let workerInstance: Worker<ExecutionJobData> | null = null;

export function startWorkflowWorker(): Worker<ExecutionJobData> | null {
  try {
    if (!workerInstance) {
      workerInstance = new Worker<ExecutionJobData>(
        QUEUE_NAME,
        async (job: Job<ExecutionJobData>) => {
          console.log(`[BullMQ Worker] Processing execution job ${job.id} for workflow ${job.data.workflowName}`);
          const result = await executeDAGWorkflow(job.data);
          if (!result.success) {
            throw new Error(result.error || "DAG Execution failed");
          }
          return result;
        },
        {
          connection: getRedisOptions(),
          concurrency: 5,
        }
      );

      workerInstance.on("completed", (job) => {
        console.log(`[BullMQ Worker] Job ${job.id} completed successfully.`);
      });

      workerInstance.on("failed", (job, err) => {
        console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err);
      });
    }

    return workerInstance;
  } catch (err) {
    console.warn("[BullMQ Worker] Could not start worker process:", err);
    return null;
  }
}
