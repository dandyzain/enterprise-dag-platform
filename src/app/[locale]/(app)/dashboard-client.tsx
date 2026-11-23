"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Gauge,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
  Timer,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/misc";
import { StatCard } from "@/components/patterns/stat-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { DagThumbnail } from "@/components/patterns/dag-thumbnail";
import { RelativeTime } from "@/components/patterns/relative-time";
import { StatusIcon, WorkflowStatusBadge, type ExecutionStatus, type WorkflowStatus } from "@/components/patterns/status-badge";
import { RevealGroup, RevealItem, useSpotlight } from "@/components/motion/reveal";
import { useShell } from "@/components/shell/shell-context";
import { cn, formatDuration, splitNameTitle } from "@/lib/utils";
import { duration, ease, staggerContainer } from "@/components/motion/presets";
import { DashboardHero } from "./dashboard-hero";

export interface DashboardWorkflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  updatedAt: string;
  nodes: { id: string; data: { type?: string; label?: string } }[];
  edges: { id: string; source: string; target: string }[];
  lastRun: { status: ExecutionStatus; startedAt: string } | null;
}

export interface DashboardRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  durationMs: number | null;
}

export interface DashboardMetrics {
  workflows: number;
  published: number;
  runs7d: number;
  runsPerDay: { label: string; value: number }[];
  totalRuns: number;
  finishedRuns: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

type StatusFilter = "all" | "PUBLISHED" | "DRAFT" | "DISABLED";
type SortKey = "updated" | "name" | "nodes";
type ViewMode = "grid" | "list";

const VIEW_KEY = "nf-dashboard-view";

function readView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

interface DashboardClientProps {
  userName: string | null;
  workflows: DashboardWorkflow[];
  recentRuns: DashboardRun[];
  metrics: DashboardMetrics;
}

export function DashboardClient({ userName, workflows, recentRuns, metrics }: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const tUi = useTranslations("ui");
  const locale = useLocale();
  const { setNewWorkflowOpen } = useShell();

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("updated");
  const [view, setView] = React.useState<ViewMode>("grid");

  React.useEffect(() => setView(readView()), []);
  function changeView(v: ViewMode) {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // per-viewer convenience only
    }
  }

  const counts = React.useMemo(
    () => ({
      all: workflows.length,
      PUBLISHED: workflows.filter((w) => w.status === "PUBLISHED").length,
      DRAFT: workflows.filter((w) => w.status === "DRAFT").length,
      DISABLED: workflows.filter((w) => w.status === "DISABLED").length,
    }),
    [workflows]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = workflows.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (!q) return true;
      return w.name.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q) || w.id.includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, locale);
      if (sort === "nodes") return b.nodes.length - a.nodes.length;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workflows, query, status, sort, locale]);

  // Stagger cards only on the first paint; later filter changes animate instantly.
  const firstPaint = React.useRef(true);
  React.useEffect(() => {
    const id = setTimeout(() => (firstPaint.current = false), 1200);
    return () => clearTimeout(id);
  }, []);

  const preview = React.useMemo(() => {
    if (workflows.length === 0) return null;
    const latest = workflows.reduce((a, b) => (new Date(b.updatedAt) > new Date(a.updatedAt) ? b : a));
    return { name: latest.name, nodes: latest.nodes, edges: latest.edges };
  }, [workflows]);

  const hasFilters = query.trim() !== "" || status !== "all";
  const firstName = userName ? splitNameTitle(userName).name.split(" ")[0] : null;

  const sortLabels: Record<SortKey, string> = {
    updated: t("sort.updated"),
    name: t("sort.name"),
    nodes: t("sort.nodes"),
  };

  return (
    <div className="relative space-y-8">
      <DashboardHero firstName={firstName} runs7d={metrics.runs7d} preview={preview} />

      {/* KPI row */}
      <RevealGroup className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <RevealItem>
          <StatCard
            label={t("kpi.workflows")}
            value={metrics.workflows}
            locale={locale}
            icon={WorkflowIcon}
            hint={t("kpi.workflowsHint", { published: metrics.published })}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.runs")}
            value={metrics.runs7d}
            locale={locale}
            icon={Activity}
            hint={t("kpi.runsHint")}
            trend={
              metrics.totalRuns > 0
                ? {
                    data: metrics.runsPerDay,
                    ariaLabel: t("kpi.trendLabel"),
                    formatPoint: (p) => t("kpi.dayValue", { day: p.label, count: p.value }),
                  }
                : undefined
            }
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.successRate")}
            value={metrics.successRate ?? "—"}
            decimals={1}
            suffix="%"
            locale={locale}
            icon={Gauge}
            hint={metrics.successRate !== null ? t("kpi.successRateHint", { count: metrics.finishedRuns }) : t("kpi.noData")}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label={t("kpi.avgDuration")}
            value={metrics.avgDurationMs !== null ? formatDuration(metrics.avgDurationMs) : "—"}
            icon={Timer}
            hint={metrics.avgDurationMs !== null ? t("kpi.avgDurationHint") : t("kpi.noData")}
          />
        </RevealItem>
      </RevealGroup>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Workflows */}
        <section aria-labelledby="workflows-heading" className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="workflows-heading" className="flex items-center gap-2 text-base font-semibold text-fg">
              {t("workflowsTitle")}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-fg-subtle">
                {workflows.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" aria-label={`${t("sortLabel")}: ${sortLabels[sort]}`}>
                    <ArrowUpDown aria-hidden />
                    <span className="hidden sm:inline">{sortLabels[sort]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("sortLabel")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                      <DropdownMenuRadioItem key={k} value={k}>
                        {sortLabels[k]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Segmented
                size="sm"
                iconOnly
                ariaLabel={t("viewLabel")}
                value={view}
                onChange={changeView}
                options={[
                  { value: "grid", label: t("view.grid"), icon: LayoutGrid },
                  { value: "list", label: t("view.list"), icon: List },
                ]}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
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
            <div className="scrollbar-none -mx-1 flex max-w-full overflow-x-auto px-1">
              <Segmented
                size="sm"
                ariaLabel={t("filterLabel")}
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: t("filter.all"), count: counts.all },
                  { value: "PUBLISHED", label: t("filter.published"), count: counts.PUBLISHED },
                  { value: "DRAFT", label: t("filter.draft"), count: counts.DRAFT },
                  { value: "DISABLED", label: t("filter.disabled"), count: counts.DISABLED },
                ]}
              />
            </div>
          </div>

          {workflows.length === 0 ? (
            <Card>
              <EmptyState
                icon={WorkflowIcon}
                title={t("emptyTitle")}
                description={t("emptyHint")}
                actions={
                  <Button onClick={() => setNewWorkflowOpen(true)}>
                    <Plus aria-hidden /> {t("newWorkflow")}
                  </Button>
                }
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={SearchX}
                title={t("noMatches")}
                description={t("noMatchesHint")}
                actions={
                  hasFilters ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      <X aria-hidden /> {tUi("clearFilters")}
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : view === "grid" ? (
            <motion.ul layout className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label={t("workflowsTitle")}>
              <AnimatePresence mode="popLayout">
                {filtered.map((wf, i) => (
                  <motion.li
                    key={wf.id}
                    layout
                    initial={{ opacity: 0, y: firstPaint.current ? 18 : 0, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{
                      duration: firstPaint.current ? duration.deliberate : duration.base,
                      ease: ease.emphasized,
                      delay: firstPaint.current ? 0.2 + i * 0.06 : 0,
                    }}
                  >
                    <WorkflowCard wf={wf} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : (
            <Card className="overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_80px_150px_130px_24px] gap-4 border-b border-line bg-surface-2/50 px-4 py-2.5 text-xs font-medium text-fg-subtle lg:grid">
                <span>{t("columns.name")}</span>
                <span>{t("columns.status")}</span>
                <span>{t("columns.steps")}</span>
                <span>{t("columns.lastRun")}</span>
                <span>{t("columns.updated")}</span>
                <span />
              </div>
              <motion.ul layout className="divide-y divide-line" aria-label={t("workflowsTitle")}>
                <AnimatePresence initial={false} mode="popLayout">
                  {filtered.map((wf) => (
                    <motion.li
                      key={wf.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: duration.fast }}
                    >
                      <WorkflowRow wf={wf} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </Card>
          )}
        </section>

        {/* Recent activity */}
        <aside aria-labelledby="activity-heading" className="min-w-0">
          <Card className="xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 id="activity-heading" className="text-sm font-semibold text-fg">
                {t("activityTitle")}
              </h2>
              <Link
                href="/executions"
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-fg-muted transition-colors hover:text-fg"
              >
                {t("viewAll")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            {recentRuns.length === 0 ? (
              <EmptyState compact icon={Activity} title={t("kpi.noData")} description={t("activityEmpty")} />
            ) : (
              <motion.ol
                className="divide-y divide-line"
                initial="hidden"
                animate="show"
                variants={staggerContainer(0.06, 0.3)}
              >
                {recentRuns.map((run) => (
                  <motion.li
                    key={run.id}
                    className="flex items-start gap-3 px-4 py-3"
                    variants={{
                      hidden: { opacity: 0, x: 14 },
                      show: { opacity: 1, x: 0, transition: { duration: duration.slow, ease: ease.emphasized } },
                    }}
                  >
                    <StatusIcon status={run.status} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/workflows/${run.workflowId}`}
                        className="block truncate text-[13px] font-medium text-fg hover:underline hover:underline-offset-2"
                      >
                        {run.workflowName}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                        <RelativeTime date={run.startedAt} />
                        {run.durationMs !== null && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">{formatDuration(run.durationMs)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </motion.ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function WorkflowCard({ wf }: { wf: DashboardWorkflow }) {
  const t = useTranslations("dashboard");
  const onPointerMove = useSpotlight<HTMLDivElement>();

  return (
    <div
      onPointerMove={onPointerMove}
      className={cn(
        "spotlight group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-elev-1",
        "transition-[border-color,box-shadow,transform] duration-200 ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elev-2",
        "focus-within:border-line-strong"
      )}
    >
      <div className="relative h-32 border-b border-line bg-dot-grid px-4 py-3">
        <DagThumbnail nodes={wf.nodes} edges={wf.edges} ariaLabel={t("graphLabel", { count: wf.nodes.length })} />
        <div className="absolute right-3 top-3">
          <WorkflowStatusBadge status={wf.status} className="bg-overlay/90 backdrop-blur" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-sm font-semibold leading-5 text-fg">
          {/* Stretched link: the whole card is clickable, one tab stop. */}
          <Link href={`/workflows/${wf.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
            <span className="line-clamp-1">{wf.name}</span>
          </Link>
        </h3>
        <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-fg-muted">{wf.description || t("noDescription")}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-fg-subtle">
          <span className="tabular-nums">{t("steps", { count: wf.nodes.length })}</span>
          <span aria-hidden>·</span>
          {wf.lastRun ? (
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status={wf.lastRun.status} className="size-3.5" />
              <RelativeTime date={wf.lastRun.startedAt} tooltip={false} />
            </span>
          ) : (
            <span>{t("neverRun")}</span>
          )}
          <span className="ml-auto">
            {t.rich("updated", { time: () => <RelativeTime date={wf.updatedAt} tooltip={false} /> })}
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkflowRow({ wf }: { wf: DashboardWorkflow }) {
  const t = useTranslations("dashboard");
  return (
    <div className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/60 lg:grid-cols-[minmax(0,1fr)_120px_80px_150px_130px_24px]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-11 w-16 shrink-0 rounded-lg border border-line bg-dot-grid p-1 sm:block">
          <DagThumbnail nodes={wf.nodes} edges={wf.edges} ariaLabel={t("graphLabel", { count: wf.nodes.length })} />
        </div>
        <div className="min-w-0">
          <Link
            href={`/workflows/${wf.id}`}
            className="block truncate text-sm font-medium text-fg outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {wf.name}
          </Link>
          <p className="truncate text-xs text-fg-subtle">{wf.description || t("noDescription")}</p>
        </div>
      </div>
      <div className="lg:hidden">
        <WorkflowStatusBadge status={wf.status} />
      </div>
      <div className="hidden lg:block">
        <WorkflowStatusBadge status={wf.status} />
      </div>
      <span className="hidden text-[13px] tabular-nums text-fg-muted lg:block">{wf.nodes.length}</span>
      <span className="hidden items-center gap-1.5 text-[13px] text-fg-muted lg:flex">
        {wf.lastRun ? (
          <>
            <StatusIcon status={wf.lastRun.status} className="size-3.5" />
            <RelativeTime date={wf.lastRun.startedAt} tooltip={false} />
          </>
        ) : (
          <span className="text-fg-subtle">{t("neverRun")}</span>
        )}
      </span>
      <span className="hidden text-[13px] text-fg-muted lg:block">
        <RelativeTime date={wf.updatedAt} tooltip={false} />
      </span>
      <ArrowRight
        className="hidden size-4 -translate-x-1 text-fg-subtle opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 lg:block"
        aria-hidden
      />
    </div>
  );
}
