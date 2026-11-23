import { cache } from "react";
import { listWorkflows } from "@/lib/services/workflow-service";
import { listWorkflowExecutions } from "@/lib/services/execution-service";
import { getCurrentSession } from "@/lib/services/auth-service";

/**
 * Request-scoped memoised wrappers around the existing services so the app
 * shell and the page can share one fetch per request. No logic changes.
 */
export const getSessionCached = cache(getCurrentSession);
export const getWorkflowsCached = cache(listWorkflows);
export const getExecutionsCached = cache(() => listWorkflowExecutions());
