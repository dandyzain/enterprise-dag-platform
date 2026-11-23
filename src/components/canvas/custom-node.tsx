"use client";

import React, { memo } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock, Copy, FlaskConical, Loader2, Trash2, XCircle } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { NodeData } from "@/lib/dag/types";
import { NODE_META, asNodeType } from "./node-meta";
import { useCanvasUI } from "./canvas-context";

function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" className="nf-check size-4 text-success" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const CustomWorkflowNode = memo(({ id, data, selected }: NodeProps) => {
  const t = useTranslations("editor.node");
  const tNodes = useTranslations("nodes");
  const tStatus = useTranslations("status");
  const { cycleNodeIds, onNodeAction, readOnly } = useCanvasUI();

  const nodeData = data as unknown as NodeData;
  const nodeType = asNodeType(nodeData?.type);
  const meta = NODE_META[nodeType];
  const Icon = meta.icon;

  const state = nodeData?.executionState;
  const isRunning = state === "RUNNING";
  const isSuccess = state === "SUCCESS";
  const isFailed = state === "FAILED";
  const inCycle = cycleNodeIds.has(id);
  const hasTarget = nodeType !== "trigger" && nodeType !== "webhook";

  return (
    <>
      <NodeToolbar isVisible={selected && !readOnly} position={Position.Top} offset={10}>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-overlay p-0.5 shadow-elev-2" role="toolbar" aria-label={nodeData?.label}>
          {[
            { action: "test" as const, icon: FlaskConical, label: t("test") },
            { action: "duplicate" as const, icon: Copy, label: t("duplicate") },
            { action: "delete" as const, icon: Trash2, label: t("delete") },
          ].map(({ action, icon: ActionIcon, label }) => (
            <button
              key={action}
              type="button"
              title={label}
              aria-label={label}
              onClick={(e) => {
                e.stopPropagation();
                onNodeAction(id, action);
              }}
              className={cn(
                "nodrag nopan inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg pointer-coarse:size-9",
                action === "delete" && "hover:bg-failed/10 hover:text-failed"
              )}
            >
              <ActionIcon className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </NodeToolbar>

      <div
        className={cn(
          "nf-node group relative w-[260px] select-none rounded-xl border bg-surface shadow-elev-1",
          !isFailed && "animate-in fade-in-0 zoom-in-95 duration-300 ease-emphasized",
          "transition-[border-color,box-shadow,transform] duration-200 ease-standard",
          selected ? "border-accent/70 shadow-elev-2 ring-3 ring-accent/15" : "border-line hover:border-line-strong hover:shadow-elev-2",
          isSuccess && !selected && "border-success/45",
          isFailed && "animate-shake border-failed/70",
          inCycle && "border-dashed border-failed ring-3 ring-failed/15"
        )}
        aria-label={`${tNodes(`${nodeType}.short`)}: ${nodeData?.label ?? ""}${state ? ` — ${tStatus(state)}` : ""}`}
      >
        {isRunning && <span className="nf-node-ring" aria-hidden />}

        {/* Type rail */}
        <span
          className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full"
          style={{ background: meta.color }}
          aria-hidden
        />

        {hasTarget && (
          <Handle type="target" position={Position.Top} id={`${id}-target`} className="nf-handle" />
        )}

        <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="truncate text-xs font-medium text-fg-subtle">{tNodes(`${nodeType}.short`)}</span>
          </div>
          <span className="flex shrink-0 items-center" aria-hidden>
            {isRunning && <Loader2 className="size-4 animate-spin text-running" />}
            {isSuccess && <CheckDraw />}
            {isFailed && <XCircle className="size-4 text-failed" />}
            {state === "PENDING" && <Clock className="size-4 text-fg-subtle" />}
          </span>
        </div>

        <div className="px-3.5 pb-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-fg">{nodeData?.label || tNodes(`${nodeType}.short`)}</p>
          {nodeData?.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-[18px] text-fg-muted">{nodeData.description}</p>
          ) : null}
        </div>

        {inCycle && (
          <div className="mx-3.5 mb-3 flex items-center gap-1.5 rounded-md bg-failed/10 px-2 py-1 text-xs font-medium text-fg">
            <AlertTriangle className="size-3.5 text-failed" aria-hidden /> {t("inCycle")}
          </div>
        )}

        {isFailed && nodeData?.executionError && (
          <div className="mx-3.5 mb-3 rounded-md border border-failed/30 bg-failed/10 px-2 py-1.5 text-xs text-fg">
            <span className="font-medium text-failed">{t("error")}: </span>
            <span className="line-clamp-2 break-all font-mono">{nodeData.executionError}</span>
          </div>
        )}

        {(isSuccess || isFailed) && nodeData?.executionDurationMs !== undefined && (
          <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-xs">
            <span className="text-fg-subtle">{t("duration")}</span>
            <span className="font-mono tabular-nums text-fg-muted">{formatDuration(nodeData.executionDurationMs)}</span>
          </div>
        )}

        <Handle type="source" position={Position.Bottom} id={`${id}-source`} className="nf-handle" />
      </div>
    </>
  );
});

CustomWorkflowNode.displayName = "CustomWorkflowNode";
