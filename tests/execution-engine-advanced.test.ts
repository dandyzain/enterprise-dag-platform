import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { executeDAGWorkflow, redactSecrets } from "@/lib/queue/workflow-executor";
import { createWorkflowExecution, getWorkflowExecutionById, setExecutionDbAvailability } from "@/lib/services/execution-service";
import { createCredential } from "@/lib/services/credential-service";
import { setHttpTransportForTesting } from "@/lib/security/safe-fetch";
import type { DAGEdge, DAGNode } from "@/lib/dag/types";

const WS = "ws_engine_tests";
const SECRET = "sk_live_super_secret_value_123";

const node = (id: string, type: DAGNode["data"]["type"], config: Record<string, unknown> = {}): DAGNode => ({
  id,
  data: { label: id, type, config },
});
const edge = (source: string, target: string): DAGEdge => ({ id: `${source}-${target}`, source, target });

async function run(nodes: DAGNode[], edges: DAGEdge[], extra: { maxDurationMs?: number } = {}) {
  const exec = await createWorkflowExecution("wf_engine", { hello: "world" }, WS);
  const result = await executeDAGWorkflow({
    executionId: exec.id,
    workflowId: "wf_engine",
    workflowName: "Engine test",
    workspaceId: WS,
    nodes,
    edges,
    triggerPayload: { email: "jane@example.com", tier: "pro" },
    ...extra,
  });
  const record = await getWorkflowExecutionById(exec.id);
  const step = (id: string) => record!.steps.find((s) => s.nodeId === id)!;
  return { result, record: record!, step };
}

describe("Execution engine — correctness fixes", () => {
  beforeAll(async () => {
    setExecutionDbAvailability(false);
    await createCredential({ workspaceId: WS, userId: "usr_test", name: "PAYMENTS_KEY", type: "api_key", value: SECRET });
  });

  afterEach(() => setHttpTransportForTesting(null));

  it("injects workspace credentials into HTTP steps and redacts them from the audit log", async () => {
    const transport = vi.fn().mockImplementation(
      async (_url: string, init: { headers: Record<string, string> }) =>
        new Response(JSON.stringify({ echoedAuth: init.headers.Authorization }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    setHttpTransportForTesting(transport);

    const { result, step } = await run(
      [node("t", "trigger"), node("call", "action", { url: "https://api.example.com/x", method: "GET", headers: { Authorization: "Bearer {{credentials.PAYMENTS_KEY}}" } })],
      [edge("t", "call")]
    );

    expect(result.status).toBe("SUCCESS");
    // The real request carried the decrypted secret...
    expect(transport.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${SECRET}`);
    // ...but nothing persisted contains it.
    const persisted = JSON.stringify(step("call"));
    expect(persisted).not.toContain(SECRET);
    expect(persisted).toContain("••••••••");
  });

  it("marks the run FAILED when an HTTP step returns 5xx, and skips dependants", async () => {
    setHttpTransportForTesting(vi.fn().mockResolvedValue(new Response("boom", { status: 503, statusText: "Service Unavailable" })));
    const { result, step } = await run(
      [node("t", "trigger"), node("call", "action", { url: "https://api.example.com/fail" }), node("after", "transform", { template: { a: 1 } })],
      [edge("t", "call"), edge("call", "after")]
    );
    expect(result.status).toBe("FAILED");
    expect(step("call").status).toBe("FAILED");
    expect(step("call").errorMessage).toContain("HTTP 503");
    expect(step("after").status).toBe("SKIPPED");
    expect(step("after").errorMessage).toContain("Upstream step failed");
  });

  it("can treat HTTP errors as data when failOnHttpError is false", async () => {
    setHttpTransportForTesting(vi.fn().mockResolvedValue(new Response("{}", { status: 404, headers: { "content-type": "application/json" } })));
    const { result, step } = await run(
      [node("t", "trigger"), node("call", "action", { url: "https://api.example.com/missing", failOnHttpError: false })],
      [edge("t", "call")]
    );
    expect(result.status).toBe("SUCCESS");
    expect((step("call").outputData as { status: number }).status).toBe(404);
  });

  it("uses AND-join semantics: a join node is skipped if any parent was skipped", async () => {
    const { result, step } = await run(
      [
        node("t", "trigger"),
        node("gate", "filter", { field: "{{trigger.body.tier}}", operator: "equals", value: "enterprise" }),
        node("other", "transform", { template: { ok: true } }),
        node("join", "transform", { template: { joined: true } }),
      ],
      [edge("t", "gate"), edge("t", "other"), edge("gate", "join"), edge("other", "join")]
    );
    expect(result.status).toBe("SUCCESS"); // a filter halting a branch is not a failure
    expect(step("other").status).toBe("SUCCESS");
    expect(step("join").status).toBe("SKIPPED");
  });

  it("runs independent steps of the same tier in parallel", async () => {
    const started = performance.now();
    const { result } = await run(
      [node("t", "trigger"), node("d1", "delay", { durationMs: 300 }), node("d2", "delay", { durationMs: 300 }), node("d3", "delay", { durationMs: 300 })],
      [edge("t", "d1"), edge("t", "d2"), edge("t", "d3")]
    );
    expect(result.status).toBe("SUCCESS");
    expect(performance.now() - started).toBeLessThan(800);
  });

  it("builds objects with the transform step and exposes them downstream", async () => {
    const { step } = await run(
      [
        node("t", "trigger"),
        node("map", "transform", { template: { contact: "{{trigger.body.email}}", plan: "{{trigger.body.tier}}" } }),
        node("check", "filter", { field: "{{steps.map.output.plan}}", operator: "equals", value: "pro" }),
      ],
      [edge("t", "map"), edge("map", "check")]
    );
    expect(step("map").outputData).toEqual({ contact: "jane@example.com", plan: "pro" });
    expect((step("check").outputData as { matched: boolean }).matched).toBe(true);
  });

  it("enforces the execution time limit", async () => {
    const { result, step } = await run(
      [node("t", "trigger"), node("wait", "delay", { durationMs: 5000 })],
      [edge("t", "wait")],
      { maxDurationMs: 200 }
    );
    expect(result.status).toBe("FAILED");
    expect(step("wait").status).toBe("FAILED");
    expect(step("wait").errorMessage).toContain("time limit");
  });

  it("blocks SSRF targets inside workflows", async () => {
    const { result, step } = await run(
      [node("t", "trigger"), node("evil", "action", { url: "http://169.254.169.254/latest/meta-data/" })],
      [edge("t", "evil")]
    );
    expect(result.status).toBe("FAILED");
    expect(step("evil").errorMessage).toContain("Anti-SSRF");
  });

  it("redactSecrets replaces secrets anywhere in nested data", () => {
    const out = redactSecrets({ a: `x${SECRET}y`, b: [SECRET], c: { d: 1 } }, [SECRET]);
    expect(JSON.stringify(out)).not.toContain(SECRET);
    expect(out.c.d).toBe(1);
  });
});
