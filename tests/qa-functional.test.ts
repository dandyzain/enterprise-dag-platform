import { describe, it, expect } from "vitest";
import { validateDAG } from "@/lib/dag/cycle-detection";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { interpolateVariables, ExecutionContext } from "@/lib/dag/variable-interpolator";
import { encryptData, decryptData } from "@/lib/crypto";
import { DAGNode, DAGEdge } from "@/lib/dag/types";

describe("QA Functional Test Suite (no server required)", () => {
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
