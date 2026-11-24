import React from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/patterns/page-container";
import { getExecutionsCached, getSessionCached, getWorkflowsCached } from "@/lib/ui/server-data";
import { DashboardClient, type DashboardWorkflow, type DashboardRun, type DashboardMetrics } from "./dashboard-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle") };
}

const DAY = 86_400_000;

export default async function DashboardPage() {
  const [session, workflows, executions, locale] = await Promise.all([
    getSessionCached(),
    getWorkflowsCached(),
    getExecutionsCached(),
    getLocale(),
  ]);

  // --- Real metrics (previously hardcoded) ------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = today.getTime() - (6 - i) * DAY;
    return { start, label: weekday.format(new Date(start)) };
  });
  const runsPerDay = days.map((d) => ({
    label: d.label,
    value: executions.filter((e) => {
      const ts = new Date(e.startedAt).getTime();
      return ts >= d.start && ts < d.start + DAY;
    }).length,
  }));

  const finished = executions.filter((e) => e.status === "SUCCESS" || e.status === "FAILED");
  const succeeded = finished.filter((e) => e.status === "SUCCESS").length;
  const durations = executions.map((e) => e.durationMs).filter((d): d is number => typeof d === "number");

  const metrics: DashboardMetrics = {
    workflows: workflows.length,
    published: workflows.filter((w) => w.status === "PUBLISHED").length,
    runs7d: runsPerDay.reduce((acc, d) => acc + d.value, 0),
    runsPerDay,
    totalRuns: executions.length,
    finishedRuns: finished.length,
    successRate: finished.length > 0 ? (succeeded / finished.length) * 100 : null,
    avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
  };

  // --- Lean, serialisable view models -----------------------------------
  const nameById = new Map(workflows.map((w) => [w.id, w.name]));
  const lastRunByWorkflow = new Map<string, { status: DashboardRun["status"]; startedAt: string }>();
  for (const e of executions) {
    if (!lastRunByWorkflow.has(e.workflowId)) {
      lastRunByWorkflow.set(e.workflowId, { status: e.status, startedAt: new Date(e.startedAt).toISOString() });
    }
  }

  const workflowItems: DashboardWorkflow[] = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description ?? null,
    status: w.status,
    updatedAt: new Date(w.updatedAt).toISOString(),
    nodes: w.nodes.map((n) => ({ id: n.id, data: { type: n.data?.type, label: n.data?.label } })),
    edges: w.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    lastRun: lastRunByWorkflow.get(w.id) ?? null,
  }));

  const recentRuns: DashboardRun[] = executions.slice(0, 8).map((e) => ({
    id: e.id,
    workflowId: e.workflowId,
    workflowName: nameById.get(e.workflowId) ?? e.workflowId,
    status: e.status,
    startedAt: new Date(e.startedAt).toISOString(),
    durationMs: e.durationMs ?? null,
  }));

  return (
    <PageContainer>
      <DashboardClient
        userName={session?.name ?? null}
        role={session?.role ?? "VIEWER"}
        workflows={workflowItems}
        recentRuns={recentRuns}
        metrics={metrics}
      />
    </PageContainer>
  );
}
