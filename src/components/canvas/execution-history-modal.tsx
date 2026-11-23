"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Clock, PlayCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/patterns/empty-state";
import { JsonView } from "@/components/patterns/json-view";
import { RelativeTime } from "@/components/patterns/relative-time";
import { ExecutionStatusBadge, StatusIcon } from "@/components/patterns/status-badge";
import type { WorkflowExecutionRecord, StepExecutionRecord } from "@/lib/services/execution-service";
import { getExecutionHistoryAction } from "@/lib/actions/workflow-actions";
import { useExecutionStream } from "@/hooks/use-execution-stream";
import { cn, formatDuration } from "@/lib/utils";

interface ExecutionHistoryModalProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
  onReplayExecution: (execution: WorkflowExecutionRecord) => void;
}

const NODE_VARIANT: Record<string, "trigger" | "webhook" | "action" | "filter"> = {
  trigger: "trigger",
  webhook: "webhook",
  action: "action",
  filter: "filter",
};

export function ExecutionHistoryModal({ workflowId, isOpen, onClose, onReplayExecution }: ExecutionHistoryModalProps) {
  const t = useTranslations("execution");
  const tUi = useTranslations("ui");
  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>([]);
  const [selectedExec, setSelectedExec] = useState<WorkflowExecutionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const { start, stop } = useExecutionStream();

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getExecutionHistoryAction(workflowId);
      setExecutions(data);
      if (data.length > 0) {
        setSelectedExec((prev) => {
          if (!prev) return data[0];
          return data.find((d) => d.id === prev.id) || data[0];
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) fetchHistory();
    else setMobileDetail(false);
  }, [isOpen, fetchHistory]);

  // Live SSE stream for an active execution (same endpoint as before).
  useEffect(() => {
    if (!isOpen || !selectedExec) return;
    if (selectedExec.status !== "RUNNING" && selectedExec.status !== "PENDING") return;
    const execId = selectedExec.id;
    start(workflowId, execId, {
      onStep: (step) => {
        setSelectedExec((prev) => {
          if (!prev || prev.id !== execId) return prev;
          const steps = [...prev.steps];
          const idx = steps.findIndex((s) => s.nodeId === step.nodeId);
          const record = step as unknown as StepExecutionRecord;
          if (idx >= 0) steps[idx] = record;
          else steps.push(record);
          return { ...prev, steps };
        });
      },
      onComplete: (status) => {
        setSelectedExec((prev) => (prev && prev.id === execId ? { ...prev, status: status as WorkflowExecutionRecord["status"] } : prev));
        fetchHistory();
      },
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedExec?.id, selectedExec?.status, workflowId, fetchHistory]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" closeLabel={tUi("close")} className="h-[min(85dvh,720px)]">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4 pr-24">
          <div className="min-w-0">
            <DialogTitle>{t("history")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </div>
          <Tooltip content={t("refresh")}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fetchHistory}
              disabled={isLoading}
              aria-label={t("refresh")}
              className="absolute right-12 top-3"
            >
              <RefreshCw className={cn(isLoading && "animate-spin")} aria-hidden />
            </Button>
          </Tooltip>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* List */}
          <div
            className={cn(
              "w-full shrink-0 overflow-y-auto border-line md:block md:w-80 md:border-r",
              mobileDetail && "hidden"
            )}
          >
            {isLoading && executions.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : executions.length === 0 ? (
              <EmptyState compact icon={Clock} title={t("noExecutions")} />
            ) : (
              <ul className="space-y-0.5 p-2" aria-label={t("history")}>
                {executions.map((exec) => {
                  const isSelected = selectedExec?.id === exec.id;
                  return (
                    <li key={exec.id}>
                      <button
                        type="button"
                        aria-current={isSelected || undefined}
                        onClick={() => {
                          setSelectedExec(exec);
                          setMobileDetail(true);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isSelected ? "bg-surface-3" : "hover:bg-surface-2"
                        )}
                      >
                        <StatusIcon status={exec.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs text-fg">{exec.id}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                            <RelativeTime date={exec.startedAt} tooltip={false} />
                            {exec.durationMs !== null && exec.durationMs !== undefined && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="tabular-nums">{formatDuration(exec.durationMs)}</span>
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className={cn("min-w-0 flex-1 overflow-y-auto", !mobileDetail && "hidden md:block")}>
            {selectedExec ? (
              <div className="space-y-5 p-5">
                <Button variant="ghost" size="sm" className="-ml-2 md:hidden" onClick={() => setMobileDetail(false)}>
                  <ArrowLeft aria-hidden /> {t("back")}
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-[13px] font-medium text-fg">{selectedExec.id}</span>
                      <ExecutionStatusBadge status={selectedExec.status} />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-fg-subtle">
                      <span>
                        {t("started")}: <RelativeTime date={selectedExec.startedAt} />
                      </span>
                      {selectedExec.durationMs !== null && selectedExec.durationMs !== undefined && (
                        <span>
                          {t("duration")}: <span className="font-mono text-fg-muted">{formatDuration(selectedExec.durationMs)}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      onReplayExecution(selectedExec);
                      onClose();
                    }}
                  >
                    <PlayCircle aria-hidden /> {t("replay")}
                  </Button>
                </div>

                <section className="space-y-3">
                  <h3 className="text-[13px] font-semibold text-fg">{t("stepLogs")}</h3>
                  {selectedExec.steps.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-subtle">
                      {t("noSteps")}
                    </p>
                  ) : (
                    <ol className="space-y-2.5">
                      {selectedExec.steps.map((step, idx) => (
                        <li key={step.id ?? `${step.nodeId}-${idx}`} className="space-y-2.5 rounded-xl border border-line bg-surface p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-2xs text-fg-muted">
                                {idx + 1}
                              </span>
                              <span className="truncate font-mono text-[13px] font-medium text-fg">{step.nodeId}</span>
                              <Badge variant={NODE_VARIANT[step.nodeType] ?? "neutral"} dot>
                                {step.nodeType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.durationMs !== null && step.durationMs !== undefined && (
                                <span className="font-mono text-xs tabular-nums text-fg-muted">{formatDuration(step.durationMs)}</span>
                              )}
                              <ExecutionStatusBadge status={step.status} />
                            </div>
                          </div>
                          {step.errorMessage && (
                            <p className="break-all rounded-lg border border-failed/30 bg-failed/10 p-2 text-xs text-fg">
                              <span className="font-medium text-failed">{t("error")}: </span>
                              <span className="font-mono">{step.errorMessage}</span>
                            </p>
                          )}
                          {step.outputData !== null && step.outputData !== undefined && (
                            <div>
                              <p className="mb-1.5 text-xs text-fg-subtle">{t("output")}</p>
                              <JsonView value={step.outputData} maxHeight="max-h-48" />
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-fg-subtle">
                {t("selectPrompt")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
