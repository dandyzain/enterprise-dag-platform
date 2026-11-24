import { isSchedulerEnabled } from "@/lib/config/env";
import { startScheduler } from "@/lib/queue/scheduler";

if (process.env.NEXT_PHASE !== "phase-production-build" && isSchedulerEnabled() && !process.env.VERCEL) {
  startScheduler();
}
