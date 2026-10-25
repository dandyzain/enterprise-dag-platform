import { DAGNode, DAGEdge } from "./types";
import { getTopologicalOrder } from "./topological-sort";

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  startX?: number;
  startY?: number;
}

/**
 * Automatically calculates tidy, non-overlapping hierarchical coordinates
 * for DAG nodes based on their topological dependency ranks.
 */
export function autoLayoutDAG(
  nodes: DAGNode[],
  edges: DAGEdge[],
  options: LayoutOptions = {}
): DAGNode[] {
  if (nodes.length === 0) return [];

  const {
    nodeWidth = 260,
    horizontalSpacing = 60,
    verticalSpacing = 160,
    startX = 350,
    startY = 80,
  } = options;

  let executionBatches: string[][];
  try {
    const topo = getTopologicalOrder(nodes, edges);
    executionBatches = topo.executionBatches;
  } catch {
    // If graph has issues, fallback to single column
    return nodes.map((node, idx) => ({
      ...node,
      position: {
        x: startX,
        y: startY + idx * verticalSpacing,
      },
    }));
  }

  const nodePositionMap = new Map<string, { x: number; y: number }>();

  executionBatches.forEach((batch, rankIndex) => {
    const totalRowWidth =
      batch.length * nodeWidth + (batch.length - 1) * horizontalSpacing;
    const rowStartX = startX - totalRowWidth / 2 + nodeWidth / 2;
    const yPos = startY + rankIndex * verticalSpacing;

    batch.forEach((nodeId, nodeIndex) => {
      const xPos = rowStartX + nodeIndex * (nodeWidth + horizontalSpacing);
      nodePositionMap.set(nodeId, { x: Math.round(xPos), y: Math.round(yPos) });
    });
  });

  return nodes.map((node) => {
    const newPos = nodePositionMap.get(node.id) || node.position || { x: startX, y: startY };
    return {
      ...node,
      position: newPos,
    };
  });
}
