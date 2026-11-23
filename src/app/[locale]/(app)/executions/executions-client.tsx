"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Gauge,
  History,
  MoreHorizontal,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { RelativeTime } from "@/components/patterns/relative-time";
import { CopyButton, useCopy } from "@/components/patterns/copy-button";
import { JsonView } from "@/components/patterns/json-view";
import { ResponsivePanel } from "@/components/patterns/responsive-panel";
import { ExecutionStatusBadge, StatusIcon, type ExecutionStatus } from "@/components/patterns/status-badge";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { WorkflowExecutionRecord, StepExecutionRecord } from "@/lib/services/execution-service";
import { retryWorkflowExecutionAction } from "@/lib/actions/workflow-actions";
import { useExecutionStream } from "@/hooks/use-execution-stream";
import { cn, formatDuration } from "@/lib/utils";

interface ExecutionsClientProps {
  initialExecutions: WorkflowExecutionRecord[];
  workflowNames: Record<string, string>;
}

type StatusFilter = "ALL" | ExecutionStatus;
const PAGE_SIZE = 10;
const column = createColumnHelper<WorkflowExecutionRecord>();

const NODE_VARIANT: Record<string, "trigger" | "webhook" | "action" | "filter"> = {
  trigger: "trigger",
  webhook: "webhook",
  action: "action",
  filter: "filter",
};

export function ExecutionsClient({ initialExecutions, workflowNames }: ExecutionsClientProps) {
  const t = useTranslations("runs");
  const tStatus = useTranslations("status");
  const tUi = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>(initialExecutions);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [workflowFilter, setWorkflowFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "startedAt", desc: true }]);

  // Server refreshes hand us new props; keep local optimistic rows that the server hasn't caught up with yet.
  useEffect(() => {
    setExecutions((prev) => {
      const serverIds = new Set(initialExecutions.map((e) => e.id));
      const pending = prev.filter((e) => !serverIds.has(e.id) && e.status === "RUNNING");
      return [...pending, ...initialExecutions];
    });
  }, [initialExecutions]);

  const refresh = React.useCallback(() => startRefresh(() => router.refresh()), [router]);

  // Live feel: while anything is running, re-poll the server every 4s.
  const anyRunning = executions.some((e) => e.status === "RUNNING" || e.status === "PENDING");
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [anyRunning, refresh]);

  const workflowName = React.useCallback((id: string) => workflowNames[id] ?? id, [workflowNames]);

  const handleRetry = async (execId: string) => {
    setRetryingId(execId);
    try {
      const res = await retryWorkflowExecutionAction(execId);
      if (res.success && res.newExecutionId) {
        toast.success(t("retried", { id: res.newExecutionId }));
        const parentWorkflowId = executions.find((e) => e.id === execId)?.workflowId || "wf-enterprise-1";
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
        if (selectedId === execId) setSelectedId(newExecRecord.id);
      } else {
        toast.error(res.error || t("retryFailed"));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("retryFailed"));
    } finally {
      setRetryingId(null);
    }
  };

  // --- Metrics (real) -------------------------------------------------------
  const finished = executions.filter((e) => e.status === "SUCCESS" || e.status === "FAILED");
  const succeeded = finished.filter((e) => e.status === "SUCCESS").length;
  const failed = executions.filter((e) => e.status === "FAILED").length;
  const running = executions.filter((e) => e.status === "RUNNING" || e.status === "PENDING").length;
  const durations = executions.map((e) => e.durationMs).filter((d): d is number => typeof d === "number");
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  // --- Filtering ------------------------------------------------------------
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { ALL: executions.length, SUCCESS: 0, FAILED: 0, RUNNING: 0, PENDING: 0 };
    for (const e of executions) c[e.status] += 1;
    return c;
  }, [executions]);

  const workflowOptions = useMemo(
    () => Array.from(new Set(executions.map((e) => e.workflowId))).map((id) => ({ id, name: workflowName(id) })),
    [executions, workflowName]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return executions.filter((e) => {
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
      if (workflowFilter !== "ALL" && e.workflowId !== workflowFilter) return false;
      if (!q) return true;
      return e.id.toLowerCase().includes(q) || workflowName(e.workflowId).toLowerCase().includes(q);
    });
  }, [executions, statusFilter, workflowFilter, query, workflowName]);

  const maxDuration = Math.max(1, ...filtered.map((e) => e.durationMs ?? 0));

  const columns = useMemo(
    () => [
      column.accessor("status", {
        header: () => t("columns.status"),
        cell: (info) => <ExecutionStatusBadge status={info.getValue()} />,
        enableSorting: false,
      }),
      column.accessor("id", {
        header: () => t("columns.run"),
        cell: (info) => (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedId(info.getValue())}
              className="max-w-[180px] truncate rounded font-mono text-xs text-fg hover:underline hover:underline-offset-2"
            >
              {info.getValue()}
            </button>
          </span>
        ),
        enableSorting: false,
      }),
      column.accessor((row) => workflowName(row.workflowId), {
        id: "workflow",
        header: () => t("columns.workflow"),
        cell: (info) => (
          <Link
            href={`/workflows/${info.row.original.workflowId}`}
            className="block max-w-[240px] truncate text-[13px] text-fg-muted hover:text-fg hover:underline hover:underline-offset-2"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      column.accessor((row) => new Date(row.startedAt).getTime(), {
        id: "startedAt",
        header: () => t("columns.started"),
        cell: (info) => <RelativeTime date={info.row.original.startedAt} className="text-[13px] text-fg-muted" />,
      }),
      column.accessor((row) => row.durationMs ?? -1, {
        id: "duration",
        header: () => t("columns.duration"),
        cell: (info) => <DurationCell ms={info.row.original.durationMs ?? null} max={maxDuration} />,
      }),
      column.accessor((row) => row.steps.length, {
        id: "steps",
        header: () => t("columns.steps"),
        cell: (info) => <StepsCell steps={info.row.original.steps} />,
      }),
      column.display({
        id: "actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: (info) => (
          <RowActions
            exec={info.row.original}
            retrying={retryingId === info.row.original.id}
            onRetry={handleRetry}
            onView={() => setSelectedId(info.row.original.id)}
          />
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, workflowName, maxDuration, retryingId]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    autoResetPageIndex: true,
    getRowId: (row) => row.id,
  });

  const selected = executions.find((e) => e.id === selectedId) ?? null;
  const hasFilters = statusFilter !== "ALL" || workflowFilter !== "ALL" || query.trim() !== "";
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = filtered.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {t("title")}
            {running > 0 && (
              <Badge variant="running" live className="text-xs">
                {t("liveCount", { count: running })}
              </Badge>
            )}
          </span>
        }
        description={t("subtitle")}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden /> {t("refresh")}
          </Button>
        }
      />

      <RevealGroup className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <RevealItem>
          <StatCard label={t("kpi.total")} value={executions.length} locale={locale} icon={History} hint={t("kpi.totalHint")} />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.successRate")}
            value={finished.length ? (succeeded / finished.length) * 100 : "—"}
            decimals={1}
            suffix="%"
            locale={locale}
            icon={Gauge}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.avgDuration")}
            value={avgDuration !== null ? formatDuration(avgDuration) : "—"}
            icon={Timer}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.failed")}
            value={failed}
            locale={locale}
            icon={XCircle}
            hint={running > 0 ? t("kpi.running", { count: running }) : failed > 0 ? t("kpi.failedHint") : undefined}
          />
        </RevealItem>
      </RevealGroup>

      <section className="space-y-4">
        {/* Filters: one row above the content they scope */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="h-8 pl-9 sm:text-[13px]"
            />
          </div>
          <div className="scrollbar-none -mx-1 flex overflow-x-auto px-1">
            <Segmented
              size="sm"
              ariaLabel={t("statusFilter")}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: t("all"), count: counts.ALL },
                { value: "SUCCESS", label: tStatus("SUCCESS"), count: counts.SUCCESS },
                { value: "FAILED", label: tStatus("FAILED"), count: counts.FAILED },
                { value: "RUNNING", label: tStatus("RUNNING"), count: counts.RUNNING },
                { value: "PENDING", label: tStatus("PENDING"), count: counts.PENDING },
              ]}
            />
          </div>
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger className="h-8 w-full sm:text-[13px] lg:ml-auto lg:w-56" aria-label={t("workflowFilter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("allWorkflows")}</SelectItem>
              {workflowOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className={cn("overflow-hidden transition-opacity", isRefreshing && "opacity-70")}>
          {executions.length === 0 ? (
            <EmptyState icon={Activity} title={t("emptyTitle")} description={t("emptyHint")} />
          ) : total === 0 ? (
            <EmptyState
              compact
              icon={SearchX}
              title={t("noMatches")}
              actions={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setWorkflowFilter("ALL");
                      setQuery("");
                    }}
                  >
                    {tUi("clearFilters")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="relative hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-line bg-surface-2/50">
                        {hg.headers.map((header) => {
                          const sortable = header.column.getCanSort();
                          const dir = header.column.getIsSorted();
                          return (
                            <th
                              key={header.id}
                              scope="col"
                              aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : sortable ? "none" : undefined}
                              className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-fg-subtle first:pl-5 last:pr-5"
                            >
                              {sortable ? (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-fg"
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {dir === "asc" ? (
                                    <ArrowUp className="size-3" aria-hidden />
                                  ) : dir === "desc" ? (
                                    <ArrowDown className="size-3" aria-hidden />
                                  ) : (
                                    <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
                                  )}
                                </button>
                              ) : (
                                flexRender(header.column.columnDef.header, header.getContext())
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-line">
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "transition-colors hover:bg-surface-2/60",
                          selectedId === row.id && "bg-surface-2/80"
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-middle first:pl-5 last:pr-5">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-line md:hidden">
                {table.getRowModel().rows.map((row) => {
                  const e = row.original;
                  return (
                    <li key={row.id} className="space-y-2.5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <ExecutionStatusBadge status={e.status} />
                        <RowActions exec={e} retrying={retryingId === e.id} onRetry={handleRetry} onView={() => setSelectedId(e.id)} />
                      </div>
                      <button type="button" onClick={() => setSelectedId(e.id)} className="block w-full text-left">
                        <span className="block truncate text-sm font-medium text-fg">{workflowName(e.workflowId)}</span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-fg-subtle">{e.id}</span>
                      </button>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                        <RelativeTime date={e.startedAt} tooltip={false} />
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{formatDuration(e.durationMs)}</span>
                        <span aria-hidden>·</span>
                        <StepsCell steps={e.steps} />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-fg-subtle sm:px-5">
                <span aria-live="polite" className="tabular-nums">
                  {tUi("rangeOf", { from, to, total })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label={tUi("previous")}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <span className="px-1 tabular-nums">
                    {tUi("pageOf", { page: pageIndex + 1, total: Math.max(1, table.getPageCount()) })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label={tUi("next")}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </section>

      <RunDetailPanel
        exec={selected}
        workflowName={selected ? workflowName(selected.workflowId) : ""}
        retrying={selected ? retryingId === selected.id : false}
        onRetry={handleRetry}
        onClose={() => setSelectedId(null)}
        onUpdate={(updated) => setExecutions((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function DurationCell({ ms, max }: { ms: number | null; max: number }) {
  const t = useTranslations("runs");
  if (ms === null) return <span className="text-[13px] text-fg-subtle">—</span>;
  const pct = Math.max(3, Math.round((ms / max) * 100));
  return (
    <Tooltip content={t("durationOf", { value: `${pct}%` })}>
      <span className="flex items-center gap-2.5" tabIndex={0}>
        <span className="w-14 text-right font-mono text-xs tabular-nums text-fg">{formatDuration(ms)}</span>
        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-3 lg:block" aria-hidden>
          <span className="block h-full rounded-full bg-fg-subtle/70" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </Tooltip>
  );
}

function StepsCell({ steps }: { steps: StepExecutionRecord[] }) {
  const t = useTranslations("runs");
  const tStatus = useTranslations("status");
  const ok = steps.filter((s) => s.status === "SUCCESS").length;
  if (steps.length === 0) return <span className="text-[13px] text-fg-subtle">—</span>;
  const tone = { SUCCESS: "bg-success", FAILED: "bg-failed", RUNNING: "bg-running", PENDING: "bg-fg-subtle/50" } as const;
  return (
    <Tooltip content={steps.map((s) => `${s.nodeId}: ${tStatus(s.status)}`).join(" · ")}>
      <span className="inline-flex items-center gap-2" tabIndex={0}>
        <span className="flex gap-0.5" aria-hidden>
          {steps.slice(0, 8).map((s) => (
            <span key={s.id} className={cn("h-3 w-1.5 rounded-sm", tone[s.status])} />
          ))}
        </span>
        <span className="text-xs tabular-nums text-fg-muted">{t("stepsSummary", { ok, total: steps.length })}</span>
      </span>
    </Tooltip>
  );
}

function RowActions({
  exec,
  retrying,
  onRetry,
  onView,
}: {
  exec: WorkflowExecutionRecord;
  retrying: boolean;
  onRetry: (id: string) => void;
  onView: () => void;
}) {
  const t = useTranslations("runs");
  const { copy } = useCopy();
  return (
    <div className="flex items-center justify-end gap-1">
      {exec.status === "FAILED" && (
        <Button variant="secondary" size="xs" onClick={() => onRetry(exec.id)} loading={retrying}>
          {!retrying && <RotateCcw aria-hidden />}
          {retrying ? t("retrying") : t("retry")}
        </Button>
      )}
      <Button variant="ghost" size="xs" onClick={onView} className="hidden sm:inline-flex">
        {t("viewDetails")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={t("actions")}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onView}>
            <History aria-hidden /> {t("viewDetails")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/workflows/${exec.workflowId}?replay=${encodeURIComponent(exec.id)}`}>
              <PlayCircle aria-hidden /> {t("replayInEditor")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/workflows/${exec.workflowId}`}>
              <ExternalLink aria-hidden /> {t("openInEditor")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              if (await copy(exec.id)) toast.success(exec.id);
            }}
          >
            <Copy aria-hidden /> {t("copyId")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RunDetailPanel({
  exec,
  workflowName,
  retrying,
  onRetry,
  onClose,
  onUpdate,
}: {
  exec: WorkflowExecutionRecord | null;
  workflowName: string;
  retrying: boolean;
  onRetry: (id: string) => void;
  onClose: () => void;
  onUpdate: (exec: WorkflowExecutionRecord) => void;
}) {
  const t = useTranslations("runs");
  const tUi = useTranslations("ui");
  const format = React.useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }), []);
  const { start, stop } = useExecutionStream();
  const [openOutputs, setOpenOutputs] = useState<Set<string>>(new Set());
  const latest = React.useRef(exec);
  latest.current = exec;

  const isLive = exec ? exec.status === "RUNNING" || exec.status === "PENDING" : false;

  // Stream step updates for a live run (same SSE endpoint the canvas uses).
  useEffect(() => {
    if (!exec || !isLive) return;
    start(exec.workflowId, exec.id, {
      onStep: (step) => {
        const cur = latest.current;
        if (!cur) return;
        const steps = [...cur.steps];
        const idx = steps.findIndex((s) => s.nodeId === step.nodeId);
        const record = { ...(idx >= 0 ? steps[idx] : {}), ...step, id: step.id ?? `${cur.id}-${step.nodeId}` } as StepExecutionRecord;
        if (idx >= 0) steps[idx] = record;
        else steps.push(record);
        onUpdate({ ...cur, steps });
      },
      onComplete: (status) => {
        const cur = latest.current;
        if (cur) onUpdate({ ...cur, status: status as ExecutionStatus });
      },
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec?.id, isLive]);

  const maxStep = Math.max(1, ...(exec?.steps.map((s) => s.durationMs ?? 0) ?? [1]));

  return (
    <ResponsivePanel
      open={exec !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t("detail.title")}
      closeLabel={tUi("close")}
      description={workflowName}
      headerExtra={
        exec ? (
          <div className="flex flex-wrap items-center gap-2">
            <ExecutionStatusBadge status={exec.status} />
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pl-2 pr-0.5 font-mono text-xs text-fg-muted">
              <span className="truncate">{exec.id}</span>
              <CopyButton value={exec.id} label={t("copyId")} className="size-6" />
            </span>
          </div>
        ) : null
      }
      footer={
        exec ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {exec.status === "FAILED" && (
              <Button variant="secondary" onClick={() => onRetry(exec.id)} loading={retrying}>
                {!retrying && <RotateCcw aria-hidden />} {retrying ? t("retrying") : t("retry")}
              </Button>
            )}
            <Button asChild>
              <Link href={`/workflows/${exec.workflowId}?replay=${encodeURIComponent(exec.id)}`}>
                <PlayCircle aria-hidden /> {t("replayInEditor")}
              </Link>
            </Button>
          </div>
        ) : null
      }
    >
      {exec ? (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3">
            {[
              {
                label: t("detail.workflow"),
                value: (
                  <Link href={`/workflows/${exec.workflowId}`} className="truncate text-fg hover:underline hover:underline-offset-2">
                    {workflowName}
                  </Link>
                ),
              },
              { label: t("detail.duration"), value: <span className="font-mono tabular-nums">{formatDuration(exec.durationMs)}</span> },
              {
                label: t("detail.started"),
                value: (
                  <span className="flex flex-col">
                    <RelativeTime date={exec.startedAt} tooltip={false} />
                    <span className="text-xs text-fg-subtle" suppressHydrationWarning>
                      {format.format(new Date(exec.startedAt))}
                    </span>
                  </span>
                ),
              },
              { label: t("detail.steps"), value: <StepsCell steps={exec.steps} /> },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-xl border border-line bg-surface p-3">
                <dt className="text-xs text-fg-subtle">{item.label}</dt>
                <dd className="mt-1 min-w-0 truncate text-[13px] font-medium text-fg">{item.value}</dd>
              </div>
            ))}
          </dl>

          {isLive && (
            <p role="status" className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-running animate-live-ping" />
                <span className="relative size-2 rounded-full bg-running" />
              </span>
              {t("detail.streaming")}
            </p>
          )}

          {exec.triggerData ? (
            <details className="group rounded-xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[13px] font-medium text-fg">
                {t("detail.trigger")}
                <ChevronRight className="size-4 text-fg-subtle transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <div className="px-3 pb-3">
                <JsonView value={exec.triggerData} maxHeight="max-h-48" />
              </div>
            </details>
          ) : null}

          <section aria-labelledby="steps-heading">
            <h3 id="steps-heading" className="mb-3 text-[13px] font-semibold text-fg">
              {t("detail.steps")} <span className="font-normal text-fg-subtle">({exec.steps.length})</span>
            </h3>
            {exec.steps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-subtle">
                {t("detail.noSteps")}
              </p>
            ) : (
              <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
                {exec.steps.map((step, idx) => {
                  const open = openOutputs.has(step.id);
                  const hasOutput = step.outputData !== null && step.outputData !== undefined;
                  return (
                    <li key={step.id} className="relative flex gap-3">
                      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-overlay">
                        <StatusIcon status={step.status} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs text-fg-subtle">{t("detail.step", { n: idx + 1 })}</span>
                            <span className="truncate font-mono text-[13px] font-medium text-fg">{step.nodeId}</span>
                          </div>
                          <Badge variant={NODE_VARIANT[step.nodeType] ?? "neutral"} dot>
                            {step.nodeType}
                          </Badge>
                        </div>
                        {step.durationMs !== null && step.durationMs !== undefined && (
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                              <span
                                className="block h-full rounded-full bg-fg-subtle/70"
                                style={{ width: `${Math.max(3, (step.durationMs / maxStep) * 100)}%` }}
                              />
                            </span>
                            <span className="font-mono text-xs tabular-nums text-fg-muted">{formatDuration(step.durationMs)}</span>
                          </div>
                        )}
                        {step.errorMessage && (
                          <div className="mt-2.5 rounded-lg border border-failed/30 bg-failed/10 p-2.5 text-xs text-fg">
                            <span className="font-medium text-failed">{t("detail.error")}: </span>
                            <span className="break-all font-mono">{step.errorMessage}</span>
                          </div>
                        )}
                        {hasOutput && (
                          <div className="mt-2.5">
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() =>
                                setOpenOutputs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(step.id)) next.delete(step.id);
                                  else next.add(step.id);
                                  return next;
                                })
                              }
                              className="inline-flex items-center gap-1 rounded text-xs font-medium text-fg-muted hover:text-fg"
                            >
                              <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
                              {open ? t("detail.hideOutput") : t("detail.showOutput")}
                            </button>
                            {open && <JsonView value={step.outputData} className="mt-2" maxHeight="max-h-56" />}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </ResponsivePanel>
  );
}
