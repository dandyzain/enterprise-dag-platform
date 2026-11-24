import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Next.js request-scope mocks ------------------------------------------
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

import {
  DEMO_USERS,
  getAuthCookieName,
  registerUser,
  signSessionToken,
  verifySessionToken,
  resolveSession,
  changePassword,
  type SessionUser,
} from "@/lib/services/auth-service";
import {
  saveWorkflowAction,
  publishWorkflowAction,
  deleteWorkflowAction,
  getSingleExecutionAction,
  triggerWorkflowExecutionAction,
} from "@/lib/actions/workflow-actions";
import { listCredentialsAction, createCredentialAction } from "@/lib/actions/credential-actions";
import { testSingleStepAction } from "@/lib/actions/step-tester-actions";
import { switchDemoRoleAction } from "@/lib/actions/auth-actions";
import { getWorkflowForWorkspace } from "@/lib/services/workflow-service";
import { setExecutionDbAvailability } from "@/lib/services/execution-service";
import type { DAGNode } from "@/lib/dag/types";

function signIn(session: SessionUser | null) {
  cookieJar.clear();
  if (session) cookieJar.set(getAuthCookieName(), signSessionToken(session));
}

const owner = DEMO_USERS["admin@enterprise.io"].session;
const member = DEMO_USERS["editor@enterprise.io"].session;
const viewer = DEMO_USERS["viewer@enterprise.io"].session;

const graph: DAGNode[] = [{ id: "n1", data: { label: "Start", type: "trigger", config: { payload: {} } } }];

describe("Session tokens", () => {
  it("rejects expired tokens", () => {
    const token = signSessionToken(owner, -10);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects tokens without an expiry (legacy/forged format)", () => {
    const payload = Buffer.from(JSON.stringify(owner)).toString("base64url");
    expect(verifySessionToken(`${payload}.not-a-signature`)).toBeNull();
  });

  it("revokes older tokens after a password change", async () => {
    const email = `pw_${Date.now()}@example.com`;
    const reg = await registerUser(email, "OldPassword123!", "Pat", "Pat's team");
    expect(reg.success).toBe(true);
    const claims = verifySessionToken(signSessionToken(reg.session!))!;
    expect(await resolveSession(claims)).not.toBeNull();

    await new Promise((r) => setTimeout(r, 5));
    const changed = await changePassword(reg.session!.id, "OldPassword123!", "NewPassword456!");
    expect(changed.success).toBe(true);
    expect(await resolveSession(claims)).toBeNull();
  });
});

describe("Server actions enforce authentication and RBAC", () => {
  beforeEach(() => setExecutionDbAvailability(false));

  it("refuses anonymous callers", async () => {
    signIn(null);
    const res = await saveWorkflowAction({ id: "wf_anon", name: "x", nodes: graph, edges: [] });
    expect(res.success).toBe(false);
    expect((res as { code?: string }).code).toBe("UNAUTHENTICATED");
    expect(await listCredentialsAction()).toEqual([]);
    expect((await testSingleStepAction("action", { url: "https://example.com" })).success).toBe(false);
  });

  it("refuses viewers for write operations", async () => {
    signIn(viewer);
    const res = await saveWorkflowAction({ id: "wf_viewer", name: "x", nodes: graph, edges: [] });
    expect((res as { code?: string }).code).toBe("FORBIDDEN");
    expect((await triggerWorkflowExecutionAction("wf-enterprise-1")).success).toBe(false);
    expect((await createCredentialAction({ name: "X_KEY", type: "api_key", value: "v" })).success).toBe(false);
  });

  it("lets members edit but not publish or delete", async () => {
    signIn(member);
    const saved = await saveWorkflowAction({ id: "wf_member_1", name: "Member flow", nodes: graph, edges: [] });
    expect(saved.success).toBe(true);
    expect((await publishWorkflowAction("wf_member_1")).success).toBe(false);
    expect((await deleteWorkflowAction("wf_member_1")).success).toBe(false);

    signIn(owner);
    expect((await publishWorkflowAction("wf_member_1")).success).toBe(true);
    expect((await deleteWorkflowAction("wf_member_1")).success).toBe(true);
  });

  it("isolates tenants: no reads or overwrites across workspaces", async () => {
    const reg = await registerUser(`tenant_${Date.now()}@example.com`, "Password123!", "Other", "Other Co");
    const outsider = reg.session!;

    // The outsider cannot read the demo workspace's workflow...
    expect(await getWorkflowForWorkspace("wf-enterprise-1", outsider.workspaceId)).toBeNull();

    // ...cannot overwrite it by guessing its id...
    signIn(outsider);
    const hijack = await saveWorkflowAction({ id: "wf-enterprise-1", name: "pwned", nodes: graph, edges: [] });
    expect(hijack.success).toBe(false);

    // ...and sees none of the demo vault.
    expect(await listCredentialsAction()).toEqual([]);

    // Executions of the demo workspace are invisible too.
    signIn(owner);
    const runRes = await triggerWorkflowExecutionAction("wf-enterprise-1", { tier: "enterprise" });
    expect(runRes.success).toBe(true);
    signIn(outsider);
    expect(await getSingleExecutionAction(runRes.executionId!)).toBeNull();
    signIn(owner);
    expect(await getSingleExecutionAction(runRes.executionId!)).not.toBeNull();
  });

  it("enforces the FREE plan workflow quota", async () => {
    const reg = await registerUser(`quota_${Date.now()}@example.com`, "Password123!", "Quota", "Quota Co");
    signIn(reg.session!);
    for (let i = 0; i < 3; i++) {
      expect((await saveWorkflowAction({ id: `wf_q_${Date.now()}_${i}`, name: `Q${i}`, nodes: graph, edges: [] })).success).toBe(true);
    }
    const fourth = await saveWorkflowAction({ id: `wf_q_${Date.now()}_x`, name: "Q4", nodes: graph, edges: [] });
    expect(fourth.success).toBe(false);
    expect((fourth as { code?: string }).code).toBe("QUOTA_EXCEEDED");
  });

  it("rejects invalid cron expressions on save", async () => {
    signIn(owner);
    const res = await saveWorkflowAction({
      id: "wf_bad_cron",
      name: "Bad cron",
      nodes: [{ id: "s", data: { label: "Every", type: "schedule", config: { cron: "61 * * * *" } } }],
      edges: [],
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("minute");
  });

  it("disables the demo role switcher when demo mode is off", async () => {
    process.env.DEMO_MODE = "false";
    try {
      const res = await switchDemoRoleAction("admin@enterprise.io");
      expect(res.success).toBe(false);
    } finally {
      process.env.DEMO_MODE = "true";
    }
  });
});
