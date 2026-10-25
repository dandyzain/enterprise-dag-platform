"use client";

import React, { useTransition } from "react";
import {
  Shield,
  Layers,
  Lock,
  Building2,
  CheckCircle2,
  XCircle,
  Activity,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Zap,
  Clock,
  UserCheck,
  Server,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SessionUser } from "@/lib/services/auth-service";
import { switchDemoRoleAction } from "@/lib/actions/auth-actions";
import { MemberRole, WorkspaceLimits, hasPermission, Permission } from "@/lib/auth/rbac";
import { toast } from "sonner";

interface SettingsClientProps {
  session: SessionUser;
  activeWorkflowsCount: number;
  totalExecutionsCount: number;
  tierLimits: WorkspaceLimits;
  retentionDays: number;
  translations: {
    title: string;
    subtitle: string;
    workspaceOverview: string;
    planTiers: string;
    teamMembers: string;
    securityPolicies: string;
    switchDemoRole: string;
    workflowsQuota: string;
    executionsQuota: string;
    concurrencyQuota: string;
    retentionQuota: string;
  };
}

const ROSTER_MEMBERS = [
  {
    name: "Alex Rivera",
    email: "admin@enterprise.io",
    role: "OWNER" as MemberRole,
    title: "Head of Infrastructure / Workspace Owner",
  },
  {
    name: "Jordan Smith",
    email: "editor@enterprise.io",
    role: "MEMBER" as MemberRole,
    title: "Senior Workflow Automation Engineer",
  },
  {
    name: "Morgan Lee",
    email: "viewer@enterprise.io",
    role: "VIEWER" as MemberRole,
    title: "Compliance & Security Auditor",
  },
];

const PERMISSIONS_LIST: { key: Permission; label: string; description: string }[] = [
  { key: "workflow:create", label: "Create Workflows", description: "Design new DAG pipelines and trigger points" },
  { key: "workflow:edit", label: "Edit Canvas", description: "Modify nodes, edges, and step configuration" },
  { key: "workflow:publish", label: "Publish Pipelines", description: "Deploy pipelines to live production queues" },
  { key: "workflow:delete", label: "Delete Pipelines", description: "Permanently delete DAG workflows and metadata" },
  { key: "workflow:execute", label: "Trigger DAG Executions", description: "Dispatch test runs and webhook triggers" },
  { key: "execution:retry", label: "Retry Failed Jobs", description: "Re-queue failed executions into BullMQ" },
  { key: "credential:create", label: "Vault Write Access", description: "Store encrypted credentials & API tokens" },
  { key: "credential:view", label: "Vault Read Access", description: "Inspect credential keys and masked secrets" },
  { key: "workspace:manage", label: "Workspace & Billing Admin", description: "Configure quotas, tiers, and member access" },
];

export function SettingsClient({
  session,
  activeWorkflowsCount,
  totalExecutionsCount,
  tierLimits,
  retentionDays,
  translations: t,
}: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleSwitchDemoRole = (email: "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io") => {
    startTransition(async () => {
      try {
        const res = await switchDemoRoleAction(email);
        toast.success(`Active persona switched to ${res.session.role} (${res.session.name})`);
        window.location.reload();
      } catch {
        toast.error("Failed to switch active persona.");
      }
    });
  };

  const isUnlimitedWorkflows = tierLimits.maxWorkflows >= 999_000;
  const isUnlimitedExecutions = tierLimits.maxExecutionsPerMonth >= 999_000;

  const workflowPercent = isUnlimitedWorkflows
    ? 2
    : Math.min(100, Math.round((activeWorkflowsCount / tierLimits.maxWorkflows) * 100));

  const executionsPercent = isUnlimitedExecutions
    ? 1
    : Math.min(100, Math.round((totalExecutionsCount / tierLimits.maxExecutionsPerMonth) * 100));

  return (
    <div className="space-y-8">
      {/* Top Banner / Switcher */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-5 sm:p-6 shadow-xl animate-fade-in-up animate-shimmer">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-zinc-100">{t.title}</span>
              <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                {session.workspaceTier}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">{t.subtitle}</p>
          </div>

          {/* Quick Persona Switcher */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 space-y-1.5 shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-400 animate-bounce-subtle" />
              <span>{t.switchDemoRole}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={session.role === "OWNER" ? "default" : "outline"}
                size="sm"
                disabled={isPending}
                onClick={() => handleSwitchDemoRole("admin@enterprise.io")}
                className={`h-7 text-xs px-2.5 transition-all active:scale-95 ${
                  session.role === "OWNER"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shadow-sm"
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Owner
              </Button>
              <Button
                variant={session.role === "MEMBER" ? "default" : "outline"}
                size="sm"
                disabled={isPending}
                onClick={() => handleSwitchDemoRole("editor@enterprise.io")}
                className={`h-7 text-xs px-2.5 transition-all active:scale-95 ${
                  session.role === "MEMBER"
                    ? "bg-sky-600 hover:bg-sky-500 text-zinc-950 font-semibold shadow-sm"
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Member
              </Button>
              <Button
                variant={session.role === "VIEWER" ? "default" : "outline"}
                size="sm"
                disabled={isPending}
                onClick={() => handleSwitchDemoRole("viewer@enterprise.io")}
                className={`h-7 text-xs px-2.5 transition-all active:scale-95 ${
                  session.role === "VIEWER"
                    ? "bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold shadow-sm"
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Viewer
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quota Progress Cards */}
      <div className="space-y-3 animate-fade-in-up delay-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span>{t.planTiers}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Workflows Quota */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 card-hover-effect">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{t.workflowsQuota}</span>
              <span className="font-mono font-semibold text-zinc-100">
                {activeWorkflowsCount} / {isUnlimitedWorkflows ? "Unlimited" : tierLimits.maxWorkflows}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 progress-bar-animated"
                style={{ width: `${Math.max(5, workflowPercent)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">Active DAG graphs in current tenant</p>
          </div>

          {/* Executions Quota */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 card-hover-sky">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{t.executionsQuota}</span>
              <span className="font-mono font-semibold text-zinc-100">
                {totalExecutionsCount} / {isUnlimitedExecutions ? "Unlimited" : tierLimits.maxExecutionsPerMonth.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 progress-bar-animated"
                style={{ width: `${Math.max(5, executionsPercent)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">Pipeline runs logged this billing cycle</p>
          </div>

          {/* Concurrency Quota */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 card-hover-violet">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{t.concurrencyQuota}</span>
              <span className="font-mono font-semibold text-emerald-400">
                {session.workspaceTier === "ENTERPRISE" ? "20 Parallel" : "5 Parallel"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-violet-500 w-1/4 progress-bar-animated" />
            </div>
            <p className="text-[11px] text-zinc-500">BullMQ distributed background consumers</p>
          </div>

          {/* Retention Window */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 card-hover-effect">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{t.retentionQuota}</span>
              <span className="font-mono font-semibold text-amber-400">{retentionDays} Days</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 w-full progress-bar-animated" />
            </div>
            <p className="text-[11px] text-zinc-500">Automated audit pruning policy window</p>
          </div>
        </div>
      </div>

      {/* Security Policies & Guardrails */}
      <div className="space-y-3 animate-fade-in-up delay-150">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          <span>{t.securityPolicies}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2 card-hover-effect">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Server className="h-4 w-4 text-emerald-400" />
                <span>Anti-SSRF Egress Guard</span>
              </div>
              <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
                <span>Active</span>
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              HTTP and Webhook action nodes are sandboxed. Outbound requests to 127.0.0.1, private CIDRs (10.x, 172.16.x, 192.168.x), AWS/GCP cloud metadata (169.254.169.254), and local network protocols are blocked cryptographically.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2 card-hover-sky">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <KeyRound className="h-4 w-4 text-sky-400" />
                <span>AES-256-GCM Vault Encryption</span>
              </div>
              <Badge variant="default" className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 radar-live-dot" />
                <span>Enforced</span>
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              API keys and integration secrets stored in the Vault are encrypted using authenticated 256-bit Galois/Counter Mode with 96-bit random IVs and 128-bit authentication tags.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2 card-hover-violet">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Lock className="h-4 w-4 text-violet-400" />
                <span>Webhook Signature Verification</span>
              </div>
              <Badge variant="default" className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 radar-live-dot" />
                <span>Enabled</span>
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Inbound webhooks from Stripe and GitHub are validated using constant-time cryptographic comparison (timingSafeEqual) with a 300-second maximum replay drift window.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2 card-hover-effect">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Tenant Rate Limiting</span>
              </div>
              <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 radar-live-amber" />
                <span>60 req / min</span>
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Inbound ingestion routes enforce a token-bucket rate limiter per IP and workspace. Burst traffic exceeding the capacity returns HTTP 429 with standard Retry-After headers.
            </p>
          </div>
        </div>
      </div>

      {/* Team Roster */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-violet-400" />
          <span>{t.teamMembers}</span>
        </h3>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {ROSTER_MEMBERS.map((member) => {
              const isCurrent = session.email === member.email;
              return (
                <div
                  key={member.email}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent ? "bg-zinc-800/40" : "hover:bg-zinc-850/30"
                  } transition-colors`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-100">{member.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                          Active Persona
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">{member.email}</div>
                    <div className="text-[11px] text-zinc-500">{member.title}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        member.role === "OWNER"
                          ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30"
                          : member.role === "MEMBER"
                          ? "text-sky-400 bg-sky-950/40 border-sky-500/30"
                          : "text-amber-400 bg-amber-950/40 border-amber-500/30"
                      }`}
                    >
                      {member.role}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isCurrent || isPending}
                      onClick={() => handleSwitchDemoRole(member.email as "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io")}
                      className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs h-7"
                    >
                      Assume Role
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RBAC Permissions Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>Role-Based Access Control (RBAC) Matrix</span>
        </h3>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50">
                <th className="py-3 px-4 font-semibold text-zinc-300">Permission</th>
                <th className="py-3 px-3 font-semibold text-zinc-300 text-center">Owner</th>
                <th className="py-3 px-3 font-semibold text-zinc-300 text-center">Admin</th>
                <th className="py-3 px-3 font-semibold text-zinc-300 text-center">Member</th>
                <th className="py-3 px-3 font-semibold text-zinc-300 text-center">Viewer</th>
                <th className="py-3 px-3 font-semibold text-emerald-400 text-center">Your Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {PERMISSIONS_LIST.map((perm) => {
                const userHasPerm = hasPermission(session.role, perm.key);
                return (
                  <tr key={perm.key} className="hover:bg-zinc-850/20 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-zinc-200">{perm.label}</div>
                      <div className="text-[10px] text-zinc-500">{perm.description}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {hasPermission("OWNER", perm.key) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {hasPermission("ADMIN", perm.key) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {hasPermission("MEMBER", perm.key) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {hasPermission("VIEWER", perm.key) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center bg-emerald-950/10">
                      {userHasPerm ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                          <XCircle className="h-3.5 w-3.5 text-zinc-600" />
                          <span>Denied</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}