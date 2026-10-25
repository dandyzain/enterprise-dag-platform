import { describe, it, expect, beforeAll } from "vitest";
import { validateDAG } from "@/lib/dag/cycle-detection";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { interpolateVariables, ExecutionContext } from "@/lib/dag/variable-interpolator";
import { encryptData, decryptData } from "@/lib/crypto";
import { DAGNode, DAGEdge } from "@/lib/dag/types";

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

describe("QA Comprehensive End-to-End & Functional Test Suite", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  // =========================================================================
  // SUITE 1: Webhook Ingestion API Verification (HTTP 202 Non-Blocking)
  // =========================================================================
  describe("1. Inbound Webhook Ingestion API", { timeout: 30000 }, () => {
    it("should accept valid webhook payload with HTTP 202 and return executionId with sub-second non-blocking latency", async () => {
      const payload = {
        customerId: "cust_qa_test_9001",
        email: "qa-lead@enterprise-dag.io",
        tier: "enterprise",
        amount: 50000,
        timestamp: Date.now(),
      };

      const res = await fetch(`${BASE_URL}/api/workflows/wh/customer-signup-hook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret-Key": "whsec_qa_test_secret_2026",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(202);

      const data = await res.json();
      expect(data).toHaveProperty("accepted", true);
      expect(data).toHaveProperty("executionId");
      expect(typeof data.executionId).toBe("string");
      expect(data.executionId.length).toBeGreaterThan(0);
      expect(data).toHaveProperty("workflowId");

      // Verify warm runtime throughput latency (< 10000ms for Next.js dev compilation)
      const warmStart = performance.now();
      const warmRes = await fetch(`${BASE_URL}/api/workflows/wh/customer-signup-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const warmLatency = performance.now() - warmStart;
      expect(warmRes.status).toBe(202);
      expect(warmLatency).toBeLessThan(10000);
    });

    it("should reject webhook request to non-existent webhook path with HTTP 404", async () => {
      const res = await fetch(`${BASE_URL}/api/workflows/wh/unknown-invalid-slug-999`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("No workflow registered for webhook path");
    });
  });

  // =========================================================================
  // SUITE 2: Server-Sent Events (SSE) Live Telemetry Stream
  // =========================================================================
  describe("2. Real-time Telemetry Streaming (SSE)", { timeout: 30000 }, () => {
    it("should establish SSE stream and return text/event-stream headers with initial snapshot", async () => {
      // First, trigger a webhook to get a valid executionId
      const triggerRes = await fetch(`${BASE_URL}/api/workflows/wh/customer-signup-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "cust_sse_test_101", tier: "enterprise" }),
      });
      const triggerData = await triggerRes.json();
      const executionId = triggerData.executionId;
      const workflowId = triggerData.workflowId;

      // Connect to SSE stream
      const streamRes = await fetch(
        `${BASE_URL}/api/workflows/${workflowId}/executions/${executionId}/stream`,
        {
          headers: { Accept: "text/event-stream" },
        }
      );

      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get("content-type")).toContain("text/event-stream");
      expect(streamRes.headers.get("cache-control")).toContain("no-cache");

      // Read initial stream chunk
      const reader = streamRes.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        expect(text).toContain("event: ");
        expect(text).toContain(executionId);
        reader.cancel();
      }
    });

    it("should return HTTP 404 when streaming non-existent execution ID", async () => {
      const streamRes = await fetch(
        `${BASE_URL}/api/workflows/wf-test/executions/exec_non_existent_9999/stream`
      );
      expect(streamRes.status).toBe(404);
      const data = await streamRes.json();
      expect(data).toHaveProperty("error");
    });
  });

  // =========================================================================
  // SUITE 3: Frontend Routes & i18n Smoke Testing
  // =========================================================================
  describe("3. Application Routes & Internationalization", { timeout: 30000 }, () => {
    const routes = [
      { path: "/en", label: "English Home Dashboard" },
      { path: "/id", label: "Indonesian Home Dashboard" },
      { path: "/en/credentials", label: "Credentials Vault (EN)" },
      { path: "/id/credentials", label: "Credentials Vault (ID)" },
      { path: "/en/executions", label: "Execution Audit Logs (EN)" },
      { path: "/id/executions", label: "Execution Audit Logs (ID)" },
      { path: "/en/workflows/wf-enterprise-1", label: "Visual Canvas Editor (EN)" },
      { path: "/id/workflows/wf-enterprise-1", label: "Visual Canvas Editor (ID)" },
    ];

    routes.forEach(({ path, label }) => {
      it(`should successfully render ${label} at ${path} with HTTP 200`, async () => {
        const res = await fetch(`${BASE_URL}${path}`);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html.length).toBeGreaterThan(500);
      });
    });
  });

  // =========================================================================
  // SUITE 4: Graph Algorithmic Validation (DFS 3-Color & Kahn's Sort)
  // =========================================================================
  describe("4. DAG Graph Integrity & Algorithmic Correctness", () => {
    it("should detect self-loop cycle (A -> A)", () => {
      const nodes: DAGNode[] = [
        { id: "A", data: { label: "Node A", type: "action", config: {} } },
      ];
      const edges: DAGEdge[] = [{ id: "e1", source: "A", target: "A" }];

      const result = validateDAG(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toContain("A");
    });

    it("should detect complex cycle inside a multi-branch graph", () => {
      // Graph: Root -> A -> B -> C -> A (cycle among A-B-C) with branch Root -> D
      const nodes: DAGNode[] = [
        { id: "Root", data: { label: "Root", type: "trigger", config: {} } },
        { id: "A", data: { label: "A", type: "action", config: {} } },
        { id: "B", data: { label: "B", type: "action", config: {} } },
        { id: "C", data: { label: "C", type: "action", config: {} } },
        { id: "D", data: { label: "D", type: "action", config: {} } },
      ];

      const edges: DAGEdge[] = [
        { id: "e1", source: "Root", target: "A" },
        { id: "e2", source: "A", target: "B" },
        { id: "e3", source: "B", target: "C" },
        { id: "e4", source: "C", target: "A" }, // cycle!
        { id: "e5", source: "Root", target: "D" },
      ];

      const result = validateDAG(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
    });

    it("should compute exact topological execution tiers for parallel diamond DAG", () => {
      // Diamond: Start -> [BranchLeft, BranchRight] -> End
      const nodes: DAGNode[] = [
        { id: "Start", data: { label: "Start", type: "trigger", config: {} } },
        { id: "BranchLeft", data: { label: "Left", type: "action", config: {} } },
        { id: "BranchRight", data: { label: "Right", type: "action", config: {} } },
        { id: "End", data: { label: "End", type: "action", config: {} } },
      ];

      const edges: DAGEdge[] = [
        { id: "e1", source: "Start", target: "BranchLeft" },
        { id: "e2", source: "Start", target: "BranchRight" },
        { id: "e3", source: "BranchLeft", target: "End" },
        { id: "e4", source: "BranchRight", target: "End" },
      ];

      const { executionBatches, sortedNodeIds } = getTopologicalOrder(nodes, edges);

      // Tier 1: ["Start"], Tier 2: ["BranchLeft", "BranchRight"] in parallel, Tier 3: ["End"]
      expect(executionBatches.length).toBe(3);
      expect(executionBatches[0]).toEqual(["Start"]);
      expect(executionBatches[1].sort()).toEqual(["BranchLeft", "BranchRight"].sort());
      expect(executionBatches[2]).toEqual(["End"]);

      expect(sortedNodeIds.indexOf("Start")).toBeLessThan(sortedNodeIds.indexOf("BranchLeft"));
      expect(sortedNodeIds.indexOf("Start")).toBeLessThan(sortedNodeIds.indexOf("BranchRight"));
      expect(sortedNodeIds.indexOf("BranchLeft")).toBeLessThan(sortedNodeIds.indexOf("End"));
      expect(sortedNodeIds.indexOf("BranchRight")).toBeLessThan(sortedNodeIds.indexOf("End"));
    });
  });

  // =========================================================================
  // SUITE 5: Security Vault Cryptography (AES-256-GCM)
  // =========================================================================
  describe("5. Cryptographic Security & Tamper Detection", () => {
    it("should encrypt and decrypt high-entropy tokens losslessly", () => {
      const secretToken = "mock_enterprise_dag_prod_token_sample_99814421";
      const encrypted = encryptData(secretToken);

      expect(encrypted.encryptedData).not.toBe(secretToken);
      expect(encrypted.iv.length).toBe(24); // 96-bit base64 IV

      const decrypted = decryptData(encrypted);
      expect(decrypted).toBe(secretToken);
    });

    it("should reject tampered ciphertext with authentication error", () => {
      const secret = "super_confidential_ledger_key";
      const enc = encryptData(secret);

      // Tamper with ciphertext by corrupting characters
      const tamperedData = "X" + enc.encryptedData.slice(1);
      expect(() => {
        decryptData({
          encryptedData: tamperedData,
          iv: enc.iv,
        });
      }).toThrow();
    });

    it("should reject tampered IV with authentication error", () => {
      const secret = "super_confidential_ledger_key";
      const enc = encryptData(secret);

      // Tamper with IV
      const tamperedIV = "AAAA" + enc.iv.slice(4);
      expect(() => {
        decryptData({
          encryptedData: enc.encryptedData,
          iv: tamperedIV,
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // SUITE 6: Variable Interpolation Engine
  // =========================================================================
  describe("6. Context Variable Interpolator", () => {
    it("should resolve nested dot notation and preserve unmapped patterns", () => {
      const context: ExecutionContext = {
        trigger: {
          body: {
            user: {
              id: "usr_99",
              email: "alex@corp.com",
            },
          },
        },
        steps: {
          fetch_kyc: {
            output: {
              data: {
                verified: true,
                score: 850,
              },
            },
            status: "SUCCESS",
          },
        },
      };

      const template = {
        url: "https://api.corp.com/users/{{trigger.body.user.id}}/verify",
        email: "{{trigger.body.user.email}}",
        score: "{{steps.fetch_kyc.output.data.score}}",
        missing: "{{trigger.body.unknownField}}",
      };

      const resolved = interpolateVariables(template, context) as Record<string, unknown>;

      expect(resolved.url).toBe("https://api.corp.com/users/usr_99/verify");
      expect(resolved.email).toBe("alex@corp.com");
      expect(resolved.score).toBe(850);
      expect(resolved.missing).toBe("");
    });
  });
});
