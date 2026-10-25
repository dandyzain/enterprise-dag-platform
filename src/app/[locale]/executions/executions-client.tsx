"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Code2,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/routing";
import { WorkflowExecutionRecord } from "@/lib/services/execution-service";
import { retryWorkflowExecutionAction } from "@/lib/actions/workflow-actions";
import { toast } from "sonner";

interface ExecutionsClientProps {
  initialExecutions: WorkflowExecutionRecord[];
}

export function ExecutionsClient({ initialExecutions }: ExecutionsClientProps) {
  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>(initialExecutions);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedExec, setSelectedExec] = useState<WorkflowExecutionRecord | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (execId: string) => {
    setRetryingId(execId);
    try {
      const res = await retryWorkflowExecutionAction(execId);
      if (res.success && res.newExecutionId) {
        toast.success(`Execution retried successfully! New job queued: ${res.newExecutionId}`);
        const parentWorkflowId =
          executions.find((e) => e.id === execId)?.workflowId || "wf-enterprise-1";
        const newExecRecord: WorkflowExecutionRecord = {
          id: res.newExecutionId,
          workflowId: parentWorkflowId,
          status: "RUNNING",
          startedAt: new Date(),
          completedAt: null,
          durationMs: null,
          triggerData: { _retriedFrom: execId },
          steps: [],
        };
        setExecutions((prev) => [newExecRecord, ...prev]);
        if (selectedExec?.id === execId) {
          setSelectedExec(newExecRecord);
        }
      } else {
        toast.error(res.error || "Failed to retry execution.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Retry failed unexpectedly.");
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = executions.filter((e) => {
    if (statusFilter === "ALL") return true;
    return e.status === statusFilter;
  });

  const totalRuns = executions.length;
  const successfulRuns = executions.filter((e) => e.status === "SUCCESS").length;
  const successRate =
    totalRuns > 0 ? `${((successfulRuns / totalRuns) * 100).toFixed(1)}%` : "100%";
  const avgDuration =
    totalRuns > 0
      ? `${Math.round(
          executions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / totalRuns
        )}ms`
      : "0ms";

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 card-hover-effect animate-fade-in-up delay-50">
          <div className="text-xs font-medium text-zinc-400">Total Executions</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">{totalRuns}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Logged pipeline runs</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 card-hover-effect animate-fade-in-up delay-100">
          <div className="text-xs font-medium text-zinc-400">Success Rate</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{successRate}</div>
          <div className="text-[11px] text-zinc-500 mt-1">{successfulRuns} completed successfully</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 card-hover-sky animate-fade-in-up delay-150">
          <div className="text-xs font-medium text-zinc-400">Avg DAG Latency</div>
          <div className="mt-1 text-2xl font-bold text-sky-400 font-mono">{avgDuration}</div>
          <div className="text-[11px] text-zinc-500 mt-1">End-to-end topological traversal</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 card-hover-violet animate-fade-in-up delay-200">
          <div className="text-xs font-medium text-zinc-400">Queue State</div>
          <div className="mt-1 text-2xl font-bold text-violet-400 flex items-center gap-2">
            <span>Ready</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 radar-live-dot" />
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Worker pool active</div>
        </div>
      </div>

      {/* Filter Tabs & Refresh */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-800 animate-fade-in-up delay-250">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {["ALL", "SUCCESS", "FAILED", "RUNNING", "PENDING"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 shrink-0 ${
                statusFilter === status
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm scale-[1.02]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="group border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 h-8 text-xs gap-1.5 shrink-0 transition-all hover:border-zinc-700"
          title="Refresh telemetry"
        >
          <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden shadow-sm animate-fade-in-up delay-300">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            No execution logs match the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map((exec) => {
              const isSuccess = exec.status === "SUCCESS";
              const isFailed = exec.status === "FAILED";

              return (
                <div
                  key={exec.id}
                  className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 hover:bg-zinc-850/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
                      {isSuccess && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      {isFailed && (
                        <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      )}
                      {!isSuccess && !isFailed && (
                        <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                      <span className="font-mono text-xs font-semibold text-zinc-100 truncate max-w-[160px] xs:max-w-none">
                        {exec.id}
                      </span>
                      <Badge
                        variant={
                          exec.status === "SUCCESS"
                            ? "default"
                            : exec.status === "FAILED"
                            ? "failed"
                            : "running"
                        }
                        className="text-[10px] py-0 px-1.5 shrink-0"
                      >
                        {exec.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="truncate max-w-[180px]">Workflow: {exec.workflowId}</span>
                      <span>•</span>
                      <span>{new Date(exec.startedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Layers className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{exec.steps.length} steps</span>
                    </div>

                    {exec.durationMs !== null && (
                      <span className="font-mono text-emerald-400">
                        {exec.durationMs}ms
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(exec.id)}
                          disabled={retryingId === exec.id}
                          className="border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 h-8 text-xs gap-1.5 transition-colors"
                          title="Re-run failed DAG execution"
                        >
                          <RotateCcw
                            className={`h-3.5 w-3.5 ${
                              retryingId === exec.id ? "animate-spin" : ""
                            }`}
                          />
                          <span>{retryingId === exec.id ? "Retrying..." : "Retry"}</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedExec(exec)}
                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 h-8 text-xs"
                      >
                        <span>View Steps</span>
                      </Button>

                      <Link href={`/workflows/${exec.workflowId}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                          title="Open in Canvas"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step Telemetry Slide-over Drawer / Mobile Bottom Sheet */}
      {selectedExec && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-200"
            onClick={() => setSelectedExec(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] h-[85vh] rounded-t-2xl border-t border-zinc-800 bg-zinc-950/98 shadow-2xl flex flex-col p-4 sm:p-6 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[500px] sm:rounded-none sm:border-l sm:border-t-0 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
            {/* Mobile Drag Handle */}
            <div
              className="flex justify-center pt-1 pb-2 sm:hidden cursor-pointer"
              onClick={() => setSelectedExec(null)}
            >
              <div className="h-1.5 w-12 rounded-full bg-zinc-700/80" />
            </div>

            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-zinc-800">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-zinc-100 font-mono truncate max-w-[200px]">
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
                    className="text-[10px] py-0 px-1.5"
                  >
                    {selectedExec.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  Started {new Date(selectedExec.startedAt).toLocaleString()} ({selectedExec.durationMs}ms)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedExec.status === "FAILED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetry(selectedExec.id)}
                    disabled={retryingId === selectedExec.id}
                    className="border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 h-7 text-xs gap-1.5"
                  >
                    <RotateCcw
                      className={`h-3 w-3 ${
                        retryingId === selectedExec.id ? "animate-spin" : ""
                      }`}
                    />
                    <span>{retryingId === selectedExec.id ? "Retrying..." : "Retry Execution"}</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedExec(null)}
                  className="text-zinc-400 hover:text-zinc-100 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 sm:space-y-4">
              <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-sky-400" />
                <span>Step Breakdown ({selectedExec.steps.length})</span>
              </h4>

              {selectedExec.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 sm:p-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-100 font-mono truncate">
                        {step.nodeId}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                        {step.nodeType}
                      </span>
                    </div>
                    {step.durationMs !== null && (
                      <span className="font-mono text-zinc-400 text-[11px] shrink-0">
                        {step.durationMs}ms
                      </span>
                    )}
                  </div>

                  {step.errorMessage && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-950/20 p-2 text-xs text-rose-300 font-mono break-all">
                      {step.errorMessage}
                    </div>
                  )}

                  {step.outputData !== null && step.outputData !== undefined && (
                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 mb-1">
                        Output Payload:
                      </div>
                      <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48">
                        {JSON.stringify(step.outputData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
