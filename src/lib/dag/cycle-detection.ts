import { DAGEdge, DAGNode, GraphValidationResult } from "./types";

/**
 * Validates whether the given nodes and edges form a valid Directed Acyclic Graph (DAG).
 * Employs Depth-First Search (DFS) with 3-color state tracking (white=0, gray=1, black=2)
 * to detect cycles and extract the exact loop path.
 */
export function validateDAG(
  nodes: DAGNode[],
  edges: DAGEdge[]
): GraphValidationResult {
  const nodeMap = new Map<string, DAGNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Adjacency list and in-degree tracking
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Filter valid edges connecting existing nodes
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adj.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  // Find root nodes (in-degree === 0)
  const roots: string[] = [];
  const terminals: string[] = [];

  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      roots.push(nodeId);
    }
    const outgoing = adj.get(nodeId);
    if (!outgoing || outgoing.length === 0) {
      terminals.push(nodeId);
    }
  }

  // DFS Cycle Detection with 3 states:
  // 0: unvisited, 1: currently in recursion stack (gray), 2: fully processed (black)
  const visitState = new Map<string, number>();
  const parentTrack = new Map<string, string>();

  function dfs(
    currentId: string,
    path: string[]
  ): { found: boolean; cycle?: string[] } {
    visitState.set(currentId, 1);
    path.push(currentId);

    const neighbors = adj.get(currentId) ?? [];
    for (const neighbor of neighbors) {
      const state = visitState.get(neighbor) ?? 0;

      if (state === 1) {
        // Cycle detected! Extract the cycle path
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex).concat(neighbor);
        return { found: true, cycle };
      }

      if (state === 0) {
        parentTrack.set(neighbor, currentId);
        const res = dfs(neighbor, path);
        if (res.found) {
          return res;
        }
      }
    }

    visitState.set(currentId, 2);
    path.pop();
    return { found: false };
  }

  for (const node of nodes) {
    if ((visitState.get(node.id) ?? 0) === 0) {
      const res = dfs(node.id, []);
      if (res.found && res.cycle) {
        return {
          isValid: false,
          hasCycle: true,
          cycleNodes: res.cycle,
          errorMessage: `Cycle detected: ${res.cycle.join(" → ")}`,
          roots,
          terminals,
        };
      }
    }
  }

  return {
    isValid: true,
    hasCycle: false,
    roots,
    terminals,
  };
}
