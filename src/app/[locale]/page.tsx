import React from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { NexusLogo } from "@/components/brand/logo";
import {
  Workflow,
  Plus,
  Activity,
  Cpu,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/language-switcher";

import { listWorkflows } from "@/lib/services/workflow-service";
import { getCurrentSession } from "@/lib/services/auth-service";
import { UserNav } from "@/components/auth/user-nav";

export default async function DashboardPage() {
  const t = await getTranslations("common");
  const session = await getCurrentSession();
  const workflows = await listWorkflows();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 gap-3">
        <Link href="/" className="hover:opacity-95 transition-opacity">
          <NexusLogo
            size="md"
            badgeText="v1.0-prod"
            subtitle="Distributed Directed Acyclic Graph Execution Engine"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl text-xs font-medium">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-100"
          >
            Workflows
          </Link>
          <Link
            href="/executions"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Executions
          </Link>
          <Link
            href="/credentials"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Vault & Keys
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LanguageSwitcher />

          <Link href="/workflows/wf-enterprise-1">
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-1.5 px-3"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">New Pipeline</span>
              <span className="xs:hidden">New</span>
            </Button>
          </Link>

          <UserNav session={session} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8">
        {/* Mobile Navigation Tabs (visible only on small viewports) */}
        <div className="flex md:hidden items-center gap-1 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl text-xs font-medium">
          <Link
            href="/"
            className="flex-1 text-center py-2 rounded-lg bg-zinc-800 text-zinc-100 font-semibold shadow-sm"
          >
            Workflows
          </Link>
          <Link
            href="/executions"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Executions
          </Link>
          <Link
            href="/credentials"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Vault
          </Link>
          <Link
            href="/settings"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Settings
          </Link>
        </div>

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 sm:p-6 md:p-8 shadow-2xl animate-fade-in-up animate-shimmer">
          <div className="relative z-10 max-w-3xl space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-400 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Sparkles className="h-3.5 w-3.5 animate-bounce-subtle" />
              <span>Production-Grade DAG Architecture</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-50 leading-tight">
              Visual Workflow Automation & Execution Platform
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Orchestrate complex asynchronous workflows with guaranteed acyclic graph
              traversal (Kahn&apos;s algorithm), distributed BullMQ task queues, and dynamic
              variable interpolation across independent worker tiers.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/workflows/wf-enterprise-1">
                <Button size="default" className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2 shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                  <span>Launch Visual Canvas</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none animate-ambient-float" />
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 card-hover-effect animate-fade-in-up delay-100">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Active DAG Pipelines</span>
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-50">12</div>
            <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>All graphs validated acyclic</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 card-hover-effect animate-fade-in-up delay-150">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">BullMQ Worker Pool</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Cpu className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-50 flex items-center gap-2">
              <span>8 Active</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 radar-live-dot" />
            </div>
            <div className="mt-1 text-[11px] text-zinc-400 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-emerald-400" />
              <span>Redis latency: ~1.2ms</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 card-hover-sky animate-fade-in-up delay-200">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Execution Success</span>
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-400 font-mono">99.92%</div>
            <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1.5">
              <span className="text-xs">↑</span>
              <span>+0.4% from last period</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 card-hover-violet animate-fade-in-up delay-250">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">AES-256 Security</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400 font-mono">GCM Locked</div>
            <div className="mt-1 text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span>96-bit unique IV per secret</span>
            </div>
          </div>
        </div>

        {/* Pipelines Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm animate-fade-in-up delay-300">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Managed Workflows</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                  {workflows.length} Total
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Recent DAG pipelines configured with topological sort and variable bindings
              </p>
            </div>
          </div>

          <div className="divide-y divide-zinc-800">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-850/50 hover:pl-5 transition-all duration-200 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workflows/${wf.id}`}
                      className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors truncate max-w-[200px] sm:max-w-sm"
                    >
                      {wf.name}
                    </Link>
                    <Badge
                      variant={wf.status === "PUBLISHED" ? "default" : "neutral"}
                      className="shrink-0 text-[10px] py-0 px-1.5"
                    >
                      {wf.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-1">{wf.description || "DAG Automated Workflow"}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-6 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{wf.nodes.length} nodes</span>
                  </div>
                  <div className="hidden xs:block text-zinc-500">Updated: {new Date(wf.updatedAt).toLocaleTimeString()}</div>
                  <Link href={`/workflows/${wf.id}`}>
                    <Button variant="outline" size="sm" className="gap-1 border-zinc-800 hover:bg-zinc-800">
                      <span>Open Canvas</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
