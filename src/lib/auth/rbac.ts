export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type WorkspaceTier = "FREE" | "PRO" | "ENTERPRISE";

export type Permission =
  | "workflow:create"
  | "workflow:edit"
  | "workflow:delete"
  | "workflow:publish"
  | "workflow:execute"
  | "credential:create"
  | "credential:delete"
  | "credential:view"
  | "workspace:manage"
  | "execution:view"
  | "execution:retry";

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    "workflow:create",
    "workflow:edit",
    "workflow:delete",
    "workflow:publish",
    "workflow:execute",
    "credential:create",
    "credential:delete",
    "credential:view",
    "workspace:manage",
    "execution:view",
    "execution:retry",
  ],
  ADMIN: [
    "workflow:create",
    "workflow:edit",
    "workflow:delete",
    "workflow:publish",
    "workflow:execute",
    "credential:create",
    "credential:delete",
    "credential:view",
    "execution:view",
    "execution:retry",
  ],
  MEMBER: [
    "workflow:create",
    "workflow:edit",
    "workflow:execute",
    "credential:view",
    "execution:view",
    "execution:retry",
  ],
  VIEWER: [
    "execution:view",
  ],
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export interface WorkspaceLimits {
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxExecutionDurationMs: number;
  allowCustomWebhookDomain: boolean;
  allowHardwareKms: boolean;
}

export const TIER_LIMITS: Record<WorkspaceTier, WorkspaceLimits> = {
  FREE: {
    maxWorkflows: 3,
    maxExecutionsPerMonth: 500,
    maxExecutionDurationMs: 15_000,
    allowCustomWebhookDomain: false,
    allowHardwareKms: false,
  },
  PRO: {
    maxWorkflows: 25,
    maxExecutionsPerMonth: 50_000,
    maxExecutionDurationMs: 60_000,
    allowCustomWebhookDomain: false,
    allowHardwareKms: true,
  },
  ENTERPRISE: {
    maxWorkflows: 999_999,
    maxExecutionsPerMonth: 999_999_999,
    maxExecutionDurationMs: 300_000,
    allowCustomWebhookDomain: true,
    allowHardwareKms: true,
  },
};
