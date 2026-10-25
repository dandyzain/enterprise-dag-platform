"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Play,
  Webhook,
  Send,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NodeData, WorkflowNodeType } from "@/lib/dag/types";

const NODE_THEMES: Record<
  WorkflowNodeType,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeVariant: "trigger" | "action" | "filter" | "neutral";
    label: string;
    badgeText: string;
  }
> = {
  trigger: {
    icon: Play,
    accentColor: "border-violet-500/30 shadow-violet-900/10",
    badgeVariant: "trigger",
    label: "Trigger",
    badgeText: "TRIGGER",
  },
  webhook: {
    icon: Webhook,
    accentColor: "border-purple-500/30 shadow-purple-900/10",
    badgeVariant: "trigger",
    label: "Webhook",
    badgeText: "WEBHOOK",
  },
  action: {
    icon: Send,
    accentColor: "border-sky-500/30 shadow-sky-900/10",
    badgeVariant: "action",
    label: "Action",
    badgeText: "HTTP ACTION",
  },
  filter: {
    icon: GitBranch,
    accentColor: "border-amber-500/30 shadow-amber-900/10",
    badgeVariant: "filter",
    label: "Filter",
    badgeText: "RULE GATE",
  },
};

export const CustomWorkflowNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  const nodeType = (nodeData?.type || "action") as WorkflowNodeType;
  const theme = NODE_THEMES[nodeType] ?? NODE_THEMES.action;
  const IconComponent = theme.icon;

  const executionState = nodeData?.executionState;
  const isRunning = executionState === "RUNNING";
  const isSuccess = executionState === "SUCCESS";
  const isFailed = executionState === "FAILED";

  const hasTarget = nodeType !== "trigger" && nodeType !== "webhook";
  const hasSource = true;

  return (
    <div
      className={cn(
        "group relative min-w-[240px] max-w-[280px] rounded-xl border bg-zinc-900/95 p-3.5 shadow-xl transition-all duration-200 select-none hover:scale-[1.01]",
        theme.accentColor,
        selected
          ? "border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
          : "border-zinc-800 hover:border-zinc-700 hover:shadow-2xl",
        isRunning && "node-running-glow border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.35)]",
        isSuccess && "border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
        isFailed && "border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
      )}
    >
      {/* Target Handle (Top) */}
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          id={`${id}-target`}
          className={cn(
            "!h-3 !w-3 !rounded-full !border-2 !border-zinc-950 !bg-zinc-400 transition-all duration-200",
            "group-hover:!h-4 group-hover:!w-4 group-hover:!bg-emerald-400 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.9)] group-hover:!scale-110"
          )}
        />
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg border bg-zinc-800/80 text-zinc-300",
              nodeType === "trigger" && "border-violet-500/30 text-violet-400 bg-violet-950/20",
              nodeType === "webhook" && "border-purple-500/30 text-purple-400 bg-purple-950/20",
              nodeType === "action" && "border-sky-500/30 text-sky-400 bg-sky-950/20",
              nodeType === "filter" && "border-amber-500/30 text-amber-400 bg-amber-950/20"
            )}
          >
            <IconComponent className="h-4 w-4" />
          </div>
          <Badge variant={theme.badgeVariant}>{theme.badgeText}</Badge>
        </div>

        {/* Execution Status Indicator */}
        {executionState && (
          <div className="flex items-center">
            {isRunning && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}
            {isSuccess && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              </span>
            )}
            {executionState === "PENDING" && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                <Clock className="h-3 w-3" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Node Content Body */}
      <div className="mt-2.5">
        <div className="text-xs font-semibold text-zinc-100 truncate">
          {nodeData?.label || theme.label}
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
          {nodeData?.description || "Configured DAG step"}
        </div>
      </div>

      {/* Execution Diagnostics Preview */}
      {isFailed && nodeData?.executionError && (
        <div className="mt-2.5 rounded-md border border-rose-500/30 bg-rose-950/20 p-2 text-[10px] text-rose-300">
          <div className="font-semibold text-rose-400">Error:</div>
          <div className="truncate font-mono">{nodeData.executionError}</div>
        </div>
      )}

      {isSuccess && nodeData?.executionDurationMs !== undefined && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Duration</span>
          <span className="font-mono text-emerald-400">
            {nodeData.executionDurationMs}ms
          </span>
        </div>
      )}

      {/* Source Handle (Bottom) */}
      {hasSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={`${id}-source`}
          className={cn(
            "!h-3 !w-3 !rounded-full !border-2 !border-zinc-950 !bg-zinc-400 transition-all duration-200",
            "group-hover:!h-4 group-hover:!w-4 group-hover:!bg-emerald-400 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          )}
        />
      )}
    </div>
  );
});

CustomWorkflowNode.displayName = "CustomWorkflowNode";
