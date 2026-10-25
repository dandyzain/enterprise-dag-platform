import { DAGEdge, DAGNode } from "./types";

export interface TopologicalSortResult {
  sortedNodeIds: string[];
  executionBatches: string[][]; // Nodes grouped by dependency tier for parallel execution
}

/**
 * Performs topological sort using Kahn's Algorithm.
 * Returns both a sequential order and batch groups (nodes that have all dependencies met
 * and can theoretically run concurrently).
 */
export function getTopologicalOrder(
  nodes: DAGNode[],
  edges: DAGEdge[]
): TopologicalSortResult {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    if (inDegree.has(edge.target) && adj.has(edge.source)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      adj.get(edge.source)?.push(edge.target);
    }
  }

  // Queue of nodes with zero in-degree
  let currentLevel: string[] = [];
  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      currentLevel.push(nodeId);
    }
  }

  const sortedNodeIds: string[] = [];
  const executionBatches: string[][] = [];

  while (currentLevel.length > 0) {
    executionBatches.push([...currentLevel]);
    const nextLevel: string[] = [];

    for (const u of currentLevel) {
      sortedNodeIds.push(u);
      const neighbors = adj.get(u) ?? [];

      for (const v of neighbors) {
        const newDeg = (inDegree.get(v) ?? 1) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) {
          nextLevel.push(v);
        }
      }
    }

    currentLevel = nextLevel;
  }

  if (sortedNodeIds.length !== nodes.length) {
    throw new Error(
      "Topological sort failed: graph contains a cyclic dependency or unreachable nodes."
    );
  }

  return {
    sortedNodeIds,
    executionBatches,
  };
}
