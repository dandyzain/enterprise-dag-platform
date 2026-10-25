"use client";

import React from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { cn } from "@/lib/utils";

export interface CustomEdgeData {
  executionState?: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  isAnimatedFlow?: boolean;
}

export function CustomWorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as CustomEdgeData | undefined;
  const executionState = edgeData?.executionState;
  const isAnimatedFlow = edgeData?.isAnimatedFlow || executionState === "RUNNING";

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Background thicker glow when active or selected */}
      {(selected || isAnimatedFlow || executionState === "SUCCESS") && (
        <path
          d={edgePath}
          fill="none"
          stroke={
            executionState === "SUCCESS"
              ? "rgba(16, 185, 129, 0.2)"
              : executionState === "RUNNING"
              ? "rgba(245, 158, 11, 0.3)"
              : "rgba(16, 185, 129, 0.3)"
          }
          strokeWidth={selected ? 6 : 4}
          strokeLinecap="round"
        />
      )}

      {/* Main Base Edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 2,
          stroke:
            executionState === "SUCCESS"
              ? "#10b981"
              : executionState === "RUNNING"
              ? "#f59e0b"
              : executionState === "FAILED"
              ? "#f43f5e"
              : selected
              ? "#10b981"
              : "#3f3f46",
        }}
        className={cn(
          isAnimatedFlow && "animated-dag-edge",
          executionState === "RUNNING" && "animated-dag-edge-running",
          executionState === "SUCCESS" && "animated-dag-edge-success"
        )}
      />
    </>
  );
}
