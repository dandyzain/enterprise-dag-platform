import { cache } from "react";
import { listWorkflows } from "@/lib/services/workflow-service";
import { listExecutions } from "@/lib/services/execution-service";
import { getCurrentSession, listUserWorkspaces } from "@/lib/services/auth-service";
import { hasPermission } from "@/lib/auth/rbac";

/**
 * Request-scoped memoised data loaders shared by the app shell and pages.
 * Everything is scoped to the signed-in user's active workspace.
 */
export const getSessionCached = cache(getCurrentSession);

export const getWorkflowsCached = cache(async () => {
  const session = await getSessionCached();
  return session ? listWorkflows(session.workspaceId) : [];
});

export const getExecutionsCached = cache(async () => {
  const session = await getSessionCached();
  if (!session || !hasPermission(session.role, "execution:view")) return [];
  return listExecutions({ workspaceId: session.workspaceId, limit: 200 });
});

export const getWorkspacesCached = cache(async () => {
  const session = await getSessionCached();
  return session ? listUserWorkspaces(session.id) : [];
});
