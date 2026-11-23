"use client";

import * as React from "react";

export type NodeAction = "test" | "duplicate" | "delete";

interface CanvasUIContextValue {
  cycleNodeIds: Set<string>;
  hoveredEdgeId: string | null;
  readOnly: boolean;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onEdgeInsert: (edgeId: string, screen: { x: number; y: number }) => void;
  onEdgeDelete: (edgeId: string) => void;
}

const CanvasUIContext = React.createContext<CanvasUIContextValue>({
  cycleNodeIds: new Set(),
  hoveredEdgeId: null,
  readOnly: false,
  onNodeAction: () => {},
  onEdgeInsert: () => {},
  onEdgeDelete: () => {},
});

export const CanvasUIProvider = CanvasUIContext.Provider;
export const useCanvasUI = () => React.useContext(CanvasUIContext);
