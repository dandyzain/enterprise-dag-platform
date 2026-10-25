import { describe, it, expect } from "vitest";
import { validateDAG } from "@/lib/dag/cycle-detection";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { DAGNode, DAGEdge } from "@/lib/dag/types";

describe("DAG Cycle Detection & Graph Validation", () => {
  it("should validate an acyclic linear workflow graph", () => {
    const nodes: DAGNode[] = [
      { id: "A", data: { label: "Trigger", type: "trigger", config: {} } },
      { id: "B", data: { label: "Action", type: "action", config: {} } },
      { id: "C", data: { label: "Filter", type: "filter", config: {} } },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
    ];

    const result = validateDAG(nodes, edges);
    expect(result.isValid).toBe(true);
    expect(result.hasCycle).toBe(false);
    expect(result.roots).toEqual(["A"]);
    expect(result.terminals).toEqual(["C"]);
  });

  it("should validate branching and merging DAG pipelines", () => {
    const nodes: DAGNode[] = [
      { id: "Root", data: { label: "Trigger", type: "trigger", config: {} } },
      { id: "BranchA", data: { label: "Action 1", type: "action", config: {} } },
      { id: "BranchB", data: { label: "Action 2", type: "action", config: {} } },
      { id: "Merge", data: { label: "Action 3", type: "action", config: {} } },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "Root", target: "BranchA" },
      { id: "e2", source: "Root", target: "BranchB" },
      { id: "e3", source: "BranchA", target: "Merge" },
      { id: "e4", source: "BranchB", target: "Merge" },
    ];

    const result = validateDAG(nodes, edges);
    expect(result.isValid).toBe(true);
    expect(result.hasCycle).toBe(false);
    expect(result.roots).toEqual(["Root"]);
    expect(result.terminals).toEqual(["Merge"]);
  });

  it("should detect a cyclic dependency and extract the loop path", () => {
    const nodes: DAGNode[] = [
      { id: "NodeA", data: { label: "Node A", type: "action", config: {} } },
      { id: "NodeB", data: { label: "Node B", type: "action", config: {} } },
      { id: "NodeC", data: { label: "Node C", type: "action", config: {} } },
    ];

    // Cycle: NodeA -> NodeB -> NodeC -> NodeA
    const edges: DAGEdge[] = [
      { id: "e1", source: "NodeA", target: "NodeB" },
      { id: "e2", source: "NodeB", target: "NodeC" },
      { id: "e3", source: "NodeC", target: "NodeA" },
    ];

    const result = validateDAG(nodes, edges);
    expect(result.isValid).toBe(false);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toBeDefined();
    expect(result.cycleNodes?.length).toBeGreaterThanOrEqual(3);
    expect(result.errorMessage).toContain("Cycle detected");
  });
});

describe("Kahn's Topological Sort & Batch Execution", () => {
  it("should sort nodes strictly in dependency order", () => {
    const nodes: DAGNode[] = [
      { id: "C", data: { label: "Step C", type: "action", config: {} } },
      { id: "A", data: { label: "Step A", type: "trigger", config: {} } },
      { id: "B", data: { label: "Step B", type: "action", config: {} } },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
    ];

    const { sortedNodeIds, executionBatches } = getTopologicalOrder(nodes, edges);

    expect(sortedNodeIds).toEqual(["A", "B", "C"]);
    expect(executionBatches).toEqual([["A"], ["B"], ["C"]]);
  });

  it("should group parallel branches into concurrent execution batches", () => {
    const nodes: DAGNode[] = [
      { id: "Root", data: { label: "Root Trigger", type: "trigger", config: {} } },
      { id: "Branch1", data: { label: "Worker 1", type: "action", config: {} } },
      { id: "Branch2", data: { label: "Worker 2", type: "action", config: {} } },
      { id: "Join", data: { label: "Sink Action", type: "action", config: {} } },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "Root", target: "Branch1" },
      { id: "e2", source: "Root", target: "Branch2" },
      { id: "e3", source: "Branch1", target: "Join" },
      { id: "e4", source: "Branch2", target: "Join" },
    ];

    const { executionBatches } = getTopologicalOrder(nodes, edges);

    expect(executionBatches[0]).toEqual(["Root"]);
    // Branch1 and Branch2 can be executed concurrently in Batch 1
    expect(executionBatches[1].sort()).toEqual(["Branch1", "Branch2"]);
    expect(executionBatches[2]).toEqual(["Join"]);
  });
});
