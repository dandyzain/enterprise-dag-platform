"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Code2,
  RotateCcw,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WorkflowExecutionRecord,
  StepExecutionRecord,
} from "@/lib/services/execution-service";
import { getExecutionHistoryAction } from "@/lib/actions/workflow-actions";

interface ExecutionHistoryModalProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
  onReplayExecution: (execution: WorkflowExecutionRecord) => void;
}

export function ExecutionHistoryModal({
  workflowId,
  isOpen,
  onClose,
  onReplayExecution,
}: ExecutionHistoryModalProps) {
  const t = useTranslations("execution");
  const tCommon = useTranslations("common");

  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>([]);
  const [selectedExec, setSelectedExec] = useState<WorkflowExecutionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getExecutionHistoryAction(workflowId);
      setExecutions(data);
      if (data.length > 0) {
        setSelectedExec((prev) => {
          if (!prev) return data[0];
          const found = data.find((d) => d.id === prev.id);
          return found || data[0];
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  // Live SSE stream for active execution
  useEffect(() => {
    if (!isOpen || !selectedExec) return;
    if (selectedExec.status !== "RUNNING" && selectedExec.status !== "PENDING") {
      return;
    }

    const eventSource = new EventSource(
      `/api/workflows/${workflowId}/executions/${selectedExec.id}/stream`
    );

    eventSource.addEventListener("step_recorded", (e) => {
      try {
        const step: StepExecutionRecord = JSON.parse(e.data);
        setSelectedExec((prev) => {
          if (!prev || prev.id !== selectedExec.id) return prev;
          const exists = prev.steps.findIndex((s) => s.nodeId === step.nodeId);
          const newSteps = [...prev.steps];
          if (exists >= 0) {
            newSteps[exists] = step;
          } else {
            newSteps.push(step);
          }
          return { ...prev, steps: newSteps };
        });
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener("completed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setSelectedExec((prev) => {
          if (!prev || prev.id !== selectedExec.id) return prev;
          return { ...prev, status: data.status };
        });
        fetchHistory();
      } finally {
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, selectedExec?.id, selectedExec?.status, workflowId, fetchHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-6">
      <div className="relative flex flex-col h-[85vh] w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {t("history")}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Audit trail of distributed DAG pipeline executions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchHistory}
              disabled={isLoading}
              className="text-zinc-400 hover:text-zinc-100"
              title="Refresh Telemetry History"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Content Responsive Layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left: Execution List */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 max-h-44 md:max-h-none overflow-y-auto divide-y divide-zinc-800/60 bg-zinc-950/60 shrink-0">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {tCommon("loading")}
              </div>
            ) : executions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Clock className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">{t("noExecutions")}</p>
              </div>
            ) : (
              executions.map((exec) => {
                const isSelected = selectedExec?.id === exec.id;
                const isSuccess = exec.status === "SUCCESS";
                const isFailed = exec.status === "FAILED";

                return (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExec(exec)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                      isSelected
                        ? "bg-zinc-850 border-l-2 border-emerald-500 text-zinc-100"
                        : "hover:bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    <div className="space-y-1 truncate mr-2">
                      <div className="flex items-center gap-1.5">
                        {isSuccess && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        {isFailed && (
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        )}
                        {!isSuccess && !isFailed && (
                          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-mono text-[11px] truncate">
                          {exec.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                        <span>{new Date(exec.startedAt).toLocaleTimeString()}</span>
                        {exec.durationMs !== null && (
                          <span className="text-emerald-400 font-mono">
                            {exec.durationMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Step Details Inspector */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-900/20">
            {selectedExec ? (
              <div className="space-y-6">
                {/* Header Summary */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">
                        Execution:
                      </span>
                      <span className="text-xs font-semibold text-zinc-100 font-mono">
                        {selectedExec.id}
                      </span>
                      <Badge
                        variant={
                          selectedExec.status === "SUCCESS"
                            ? "default"
                            : selectedExec.status === "FAILED"
                            ? "failed"
                            : "running"
                        }
                      >
                        {selectedExec.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-4">
                      <span>
                        Started: {new Date(selectedExec.startedAt).toLocaleString()}
                      </span>
                      {selectedExec.durationMs !== null && (
                        <span>
                          Duration:{" "}
                          <strong className="text-emerald-400 font-mono">
                            {selectedExec.durationMs}ms
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onReplayExecution(selectedExec);
                      onClose();
                    }}
                    className="gap-1.5 border-zinc-700 bg-zinc-800 hover:bg-zinc-750 text-zinc-100 shadow-sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Replay on Canvas</span>
                  </Button>
                </div>

                {/* Steps Breakdown */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>{t("stepLogs")}</span>
                  </h3>

                  {selectedExec.steps.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500">
                      No step telemetry recorded for this execution.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedExec.steps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-zinc-100 font-mono">
                                {step.nodeId}
                              </span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                {step.nodeType}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {step.durationMs !== null && (
                                <span className="font-mono text-[11px] text-zinc-400">
                                  {step.durationMs}ms
                                </span>
                              )}
                              <Badge
                                variant={
                                  step.status === "SUCCESS"
                                    ? "default"
                                    : step.status === "FAILED"
                                    ? "failed"
                                    : "running"
                                }
                              >
                                {step.status}
                              </Badge>
                            </div>
                          </div>

                          {step.errorMessage && (
                            <div className="rounded-md border border-rose-500/30 bg-rose-950/20 p-2 text-xs text-rose-300">
                              <strong className="text-rose-400">Error: </strong>
                              <span className="font-mono">{step.errorMessage}</span>
                            </div>
                          )}

                          {step.outputData !== null && step.outputData !== undefined && (
                            <div>
                              <div className="text-[10px] font-mono text-zinc-400 mb-1">
                                Output Telemetry:
                              </div>
                              <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-40">
                                {JSON.stringify(step.outputData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Select an execution on the left to inspect step telemetry.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
