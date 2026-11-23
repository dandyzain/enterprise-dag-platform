"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Eraser } from "lucide-react";
import type { DAGEdge, DAGNode } from "@/lib/dag/types";
import { computeTiers } from "@/lib/ui/graph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusIcon } from "@/components/patterns/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatDuration } from "@/lib/utils";
import { duration, ease } from "@/components/motion/presets";
import { NODE_META, asNodeType } from "./node-meta";

export interface RunLog {
  id: string;
  at: number;
  level: "info" | "running" | "success" | "error";
  message: string;
}

interface RunPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: DAGNode[];
  edges: DAGEdge[];
  logs: RunLog[];
  onClearLogs: () => void;
  isExecuting: boolean;
}

const LEVEL_DOT: Record<RunLog["level"], string> = {
  info: "bg-fg-subtle",
  running: "bg-running",
  success: "bg-success",
  error: "bg-failed",
};

/** Collapsible bottom panel: per-tier step timeline + live log. */
export function RunPanel({ open, onOpenChange, nodes, edges, logs, onClearLogs, isExecuting }: RunPanelProps) {
  const t = useTranslations("editor.runPanel");
  const tStatus = useTranslations("status");
  const logEnd = React.useRef<HTMLDivElement>(null);

  const tiers = React.useMemo(() => computeTiers(nodes, edges), [nodes, edges]);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const executed = nodes.filter((n) => n.data.executionState);
  const done = nodes.filter((n) => n.data.executionState === "SUCCESS" || n.data.executionState === "FAILED").length;
  const total = nodes.length;
  const hasRun = executed.length > 0 || isExecuting;
  const maxDuration = Math.max(1, ...nodes.map((n) => n.data.executionDurationMs ?? 0));
  const progress = total ? (done / total) * 100 : 0;

  React.useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [logs.length]);

  return (
    <section aria-label={t("title")} className="relative shrink-0 border-t border-line bg-overlay">
      {/* Progress hairline */}
      {hasRun && (
        <div className="absolute inset-x-0 -top-px h-0.5 overflow-hidden bg-transparent" aria-hidden>
          <motion.div
            className="h-full bg-signal"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: duration.slow, ease: ease.emphasized }}
          />
        </div>
      )}
      <div className="flex h-10 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 rounded-md text-[13px] font-medium text-fg"
        >
          <ChevronDown className={cn("size-4 text-fg-subtle transition-transform duration-200", !open && "-rotate-180")} aria-hidden />
          {t("title")}
          <span className="sr-only">{open ? t("collapse") : t("expand")}</span>
        </button>
        {hasRun && (
          <span className="flex items-center gap-2 text-xs text-fg-subtle" aria-live="polite">
            {isExecuting && (
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inset-0 animate-live-ping rounded-full bg-running" />
                <span className="relative size-2 rounded-full bg-running" />
              </span>
            )}
            {t("progress", { done, total })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {open && logs.length > 0 && (
            <Tooltip content={t("clear")}>
              <button
                type="button"
                onClick={onClearLogs}
                aria-label={t("clear")}
                className="inline-flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
              >
                <Eraser className="size-3.5" aria-hidden />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.emphasized }}
            className="overflow-hidden"
          >
            <div className="h-[min(15rem,38dvh)] border-t border-line">
              {!hasRun && logs.length === 0 ? (
                <p className="flex h-full items-center justify-center px-6 text-center text-[13px] text-fg-subtle">{t("idle")}</p>
              ) : (
                <Tabs defaultValue="timeline" className="flex h-full flex-col">
                  <TabsList className="px-2">
                    <TabsTrigger value="timeline" className="group-data-[variant=underline]/tabs:h-9 text-[13px]">
                      {t("title")}
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="group-data-[variant=underline]/tabs:h-9 text-[13px]">
                      {t("logs")}
                      {logs.length > 0 && <span className="rounded-full bg-surface-3 px-1.5 text-2xs tabular-nums text-fg-subtle">{logs.length}</span>}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="timeline" className="min-h-0 flex-1 overflow-auto p-3">
                    <ol className="flex min-w-max gap-3">
                      {tiers.map((tier, i) => (
                        <li key={i} className="w-56 shrink-0">
                          <p className="mb-2 px-1 text-xs font-medium text-fg-subtle">{t("tier", { n: i + 1 })}</p>
                          <ul className="space-y-1.5">
                            {tier.map((id) => {
                              const n = byId.get(id);
                              if (!n) return null;
                              const state = n.data.executionState;
                              const meta = NODE_META[asNodeType(n.data.type)];
                              const d = n.data.executionDurationMs;
                              return (
                                <li key={id} className="rounded-lg border border-line bg-surface p-2.5">
                                  <div className="flex items-center gap-2">
                                    {state ? (
                                      <StatusIcon status={state} className="size-3.5" />
                                    ) : (
                                      <span className="size-3.5 rounded-full border border-dashed border-line-strong" aria-label={tStatus("PENDING")} role="img" />
                                    )}
                                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{n.data.label || id}</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                                      <motion.span
                                        className={cn(
                                          "block h-full rounded-full",
                                          state === "FAILED" ? "bg-failed" : state === "RUNNING" ? "bg-running" : "bg-fg-subtle/70"
                                        )}
                                        initial={false}
                                        animate={{ width: state === "RUNNING" ? "35%" : d ? `${Math.max(4, (d / maxDuration) * 100)}%` : "0%" }}
                                        transition={{ duration: duration.slow, ease: ease.emphasized }}
                                      />
                                    </span>
                                    <span className="w-12 text-right font-mono text-2xs tabular-nums text-fg-subtle">
                                      {d !== undefined ? formatDuration(d) : state ? tStatus(state) : "—"}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </TabsContent>
                  <TabsContent value="logs" className="min-h-0 flex-1 overflow-auto px-3 py-2">
                    {logs.length === 0 ? (
                      <p className="py-6 text-center text-[13px] text-fg-subtle">{t("noLogs")}</p>
                    ) : (
                      <ol className="space-y-1 font-mono text-xs" aria-live="polite" aria-relevant="additions">
                        {logs.map((log) => (
                          <li key={log.id} className="flex items-start gap-2.5 rounded px-1 py-0.5 hover:bg-surface-2">
                            <span className="shrink-0 tabular-nums text-fg-subtle" suppressHydrationWarning>
                              {new Date(log.at).toLocaleTimeString([], { hour12: false })}
                            </span>
                            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", LEVEL_DOT[log.level])} aria-hidden />
                            <span className="min-w-0 break-words text-fg-muted">{log.message}</span>
                          </li>
                        ))}
                        <div ref={logEnd} />
                      </ol>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
