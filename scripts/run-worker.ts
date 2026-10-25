import { startWorkflowWorker } from "../src/lib/queue/workflow-worker";

console.log("=================================================");
console.log("   NEXUSFLOW DISTRIBUTED BACKGROUND WORKER       ");
console.log("   Queue: workflow-execution-queue                ");
console.log("   Concurrency: 5 Parallel DAG Execution Tiers   ");
console.log("=================================================");

const worker = startWorkflowWorker();

if (!worker) {
  console.log("⚠️  Redis is currently unreachable. Worker running in non-blocking fallback mode.");
} else {
  console.log("🚀 BullMQ Worker daemon is active and listening for execution jobs...");
}

function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  if (worker) {
    worker.close().then(() => {
      console.log("✓ Worker cleanly disconnected from Redis queue. Exiting.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
