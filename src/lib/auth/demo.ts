/**
 * Public demo accounts. They only exist while demo mode is on (see
 * `isDemoMode()`) and all live in one isolated demo workspace, so the role
 * switcher shows the *same* data through OWNER / MEMBER / VIEWER eyes and a
 * demo login can never reach a real customer's workspace.
 */
import type { MemberRole, WorkspaceTier } from "@/lib/auth/rbac";

export const DEMO_WORKSPACE = {
  id: "ws_acme_global",
  name: "Acme Global Enterprise",
  slug: "acme-enterprise",
  tier: "ENTERPRISE" as WorkspaceTier,
};

export type DemoEmail = "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io";

export const DEMO_PASSWORD = "Password123!";

export const DEMO_ACCOUNTS: Record<DemoEmail, { id: string; name: string; role: MemberRole }> = {
  "admin@enterprise.io": { id: "usr_admin_enterprise", name: "Alex Vance (Lead Architect)", role: "OWNER" },
  "editor@enterprise.io": { id: "usr_editor_fintech", name: "Marcus Aurelius (DAG Engineer)", role: "MEMBER" },
  "viewer@enterprise.io": { id: "usr_viewer_auditor", name: "Sarah Chen (Compliance Auditor)", role: "VIEWER" },
};

export const DEMO_EMAILS = Object.keys(DEMO_ACCOUNTS) as DemoEmail[];

export function isDemoEmail(email: string): email is DemoEmail {
  return (DEMO_EMAILS as string[]).includes(email.toLowerCase().trim());
}

export function isDemoUserId(userId: string): boolean {
  return Object.values(DEMO_ACCOUNTS).some((a) => a.id === userId);
}
