"use client";

import React from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasUI } from "./canvas-context";

export interface CustomEdgeData {
  executionState?: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  isAnimatedFlow?: boolean;
}

const STROKE: Record<string, string> = {
  SUCCESS: "var(--success)",
  RUNNING: "var(--running)",
  FAILED: "var(--failed)",
};

/** Arrow markers referenced by every edge (one set per state). */
export function EdgeMarkers() {
  const markers = [
    ["default", "var(--line-strong)"],
    ["selected", "var(--accent)"],
    ["SUCCESS", "var(--success)"],
    ["RUNNING", "var(--running)"],
    ["FAILED", "var(--failed)"],
  ] as const;
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {markers.map(([key, color]) => (
          <marker
            key={key}
            id={`nf-arrow-${key}`}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M1,1.5 L8.5,5 L1,8.5 Z" fill={color} style={{ fill: color }} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

export function CustomWorkflowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: EdgeProps) {
  const t = useTranslations("editor.node");
  const reduce = useReducedMotion();
  const { hoveredEdgeId, onEdgeInsert, onEdgeDelete, cycleNodeIds, readOnly } = useCanvasUI();
  const edgeData = data as CustomEdgeData | undefined;
  const state = edgeData?.executionState;
  const running = edgeData?.isAnimatedFlow || state === "RUNNING";

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
    offset: 18,
  });

  const inCycle = cycleNodeIds.has(source) && cycleNodeIds.has(target);
  const stroke = inCycle ? "var(--failed)" : state ? STROKE[state] : selected ? "var(--accent)" : "var(--line-strong)";
  const markerKey = inCycle ? "FAILED" : state ?? (selected ? "selected" : "default");
  const showControls = !readOnly && (hoveredEdgeId === id || selected);

  return (
    <>
      {(selected || running || state === "SUCCESS") && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeOpacity={0.18}
          strokeWidth={selected ? 7 : 5}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#nf-arrow-${markerKey})`}
        interactionWidth={22}
        style={{
          ...style,
          stroke,
          strokeWidth: selected ? 2.25 : 1.75,
          strokeDasharray: inCycle ? "5 4" : undefined,
          transition: "stroke 200ms",
        }}
        className={cn(running && "nf-edge-running")}
      />
      {running && !reduce && (
        <circle r={3.5} fill="var(--running)" className="pointer-events-none">
          <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {showControls && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-0.5 rounded-full border border-line bg-overlay p-0.5 shadow-elev-2"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <button
              type="button"
              aria-label={t("insert")}
              title={t("insert")}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeInsert(id, { x: e.clientX, y: e.clientY });
              }}
              className="inline-flex size-6 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-accent/15 hover:text-accent pointer-coarse:size-8"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("deleteEdge")}
              title={t("deleteEdge")}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeDelete(id);
              }}
              className="inline-flex size-6 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-failed/10 hover:text-failed pointer-coarse:size-8"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
