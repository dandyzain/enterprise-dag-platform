"use client";

import { useCallback, useReducer, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Undo/redo for the canvas. Call `takeSnapshot()` *before* a structural change
 * (add, delete, connect, drag start, layout, template/import, config edits).
 * Pass `coalesceMs` to merge bursts (e.g. typing in the inspector).
 */
export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
  max = 80
) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const latest = useRef<Snapshot>({ nodes, edges });
  latest.current = { nodes, edges };
  const lastSnapshotAt = useRef(0);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const takeSnapshot = useCallback(
    (opts?: { coalesceMs?: number }) => {
      const now = Date.now();
      if (opts?.coalesceMs && now - lastSnapshotAt.current < opts.coalesceMs) {
        lastSnapshotAt.current = now;
        return;
      }
      lastSnapshotAt.current = now;
      past.current = [...past.current.slice(-(max - 1)), latest.current];
      future.current = [];
      rerender();
    },
    [max]
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return false;
    future.current.push(latest.current);
    setNodes(prev.nodes);
    setEdges(prev.edges);
    lastSnapshotAt.current = 0;
    rerender();
    return true;
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return false;
    past.current.push(latest.current);
    setNodes(next.nodes);
    setEdges(next.edges);
    lastSnapshotAt.current = 0;
    rerender();
    return true;
  }, [setNodes, setEdges]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
