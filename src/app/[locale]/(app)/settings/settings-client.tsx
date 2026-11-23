"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Check, KeyRound, Lock, Minus, Server, ShieldCheck, Users, Zap, Gauge, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { Meter } from "@/components/patterns/meter";
import type { SessionUser } from "@/lib/services/auth-service";
import { MemberRole, WorkspaceLimits, hasPermission, Permission } from "@/lib/auth/rbac";
import { DEMO_PERSONAS, useAccountActions, type DemoEmail } from "@/components/shell/use-account-actions";
import { cn, formatCompact, formatDuration, getInitials, splitNameTitle } from "@/lib/utils";

export type SettingsTab = "overview" | "team" | "security" | "permissions";

interface SettingsClientProps {
  session: SessionUser;
  activeWorkflowsCount: number;
  totalExecutionsCount: number;
  tierLimits: WorkspaceLimits;
  retentionDays: number;
  roster: { email: string; name: string; role: MemberRole }[];
  initialTab: SettingsTab;
}

const PERMISSIONS: { key: Permission; i18n: string }[] = [
  { key: "workflow:create", i18n: "workflowCreate" },
  { key: "workflow:edit", i18n: "workflowEdit" },
  { key: "workflow:publish", i18n: "workflowPublish" },
  { key: "workflow:delete", i18n: "workflowDelete" },
  { key: "workflow:execute", i18n: "workflowExecute" },
  { key: "execution:retry", i18n: "executionRetry" },
  { key: "credential:create", i18n: "credentialCreate" },
  { key: "credential:view", i18n: "credentialView" },
  { key: "workspace:manage", i18n: "workspaceManage" },
];

const ROLES: MemberRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

const SECURITY = [
  { key: "ssrf", icon: Server, live: true },
  { key: "vault", icon: KeyRound, live: true },
  { key: "signatures", icon: Lock, live: true },
  { key: "rateLimit", icon: Zap, live: false },
] as const;

export function SettingsClient({
  session,
  activeWorkflowsCount,
  totalExecutionsCount,
  tierLimits,
  retentionDays,
  roster,
  initialTab,
}: SettingsClientProps) {
  const t = useTranslations("settingsPage");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const { isPending, switchRole } = useAccountActions();
  const [tab, setTab] = React.useState<SettingsTab>(initialTab);

  function changeTab(value: string) {
    setTab(value as SettingsTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url.toString());
  }

  const isUnlimitedWorkflows = tierLimits.maxWorkflows >= 999_000;
  const isUnlimitedExecutions = tierLimits.maxExecutionsPerMonth >= 999_000;
  const currentPersona = (DEMO_PERSONAS.find((p) => p.email === session.email)?.email ?? "") as DemoEmail | "";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden /> {session.workspaceName}
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t("title")}
            <Badge variant="accent">
              {t("plan", { tier: session.workspaceTier.charAt(0) + session.workspaceTier.slice(1).toLowerCase() })}
            </Badge>
          </span>
        }
        description={t("subtitle")}
      />

      {/* Persona switcher (demo) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-elev-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">{t("persona")}</p>
          <p className="text-[13px] text-fg-muted">{t("personaHint")}</p>
        </div>
        <Segmented
          ariaLabel={t("switchDemoRole")}
          value={currentPersona}
          disabled={isPending}
          onChange={(email) => email && email !== currentPersona && switchRole(email as DemoEmail)}
          options={DEMO_PERSONAS.map((p) => ({ value: p.email, label: tAccount(`roles.${p.role}`) }))}
          layoutId="persona-pill"
        />
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <TabsList aria-label={t("title")}>
          <TabsTrigger value="overview">
            <Gauge aria-hidden /> {t("tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users aria-hidden /> {t("tabs.team")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck aria-hidden /> {t("tabs.security")}
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Lock aria-hidden /> {t("tabs.permissions")}
          </TabsTrigger>
        </TabsList>

        {/* Plan & usage */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <Meter
                label={t("workflowsQuota")}
                value={activeWorkflowsCount}
                max={tierLimits.maxWorkflows}
                unlimited={isUnlimitedWorkflows}
                unlimitedLabel={t("unlimited")}
                display={
                  isUnlimitedWorkflows
                    ? `${activeWorkflowsCount} · ${t("unlimited")}`
                    : t("usageOf", { used: activeWorkflowsCount, limit: tierLimits.maxWorkflows })
                }
                hint={t("workflowsHint")}
              />
            </Card>
            <Card className="p-5">
              <Meter
                label={t("executionsQuota")}
                value={totalExecutionsCount}
                max={tierLimits.maxExecutionsPerMonth}
                unlimited={isUnlimitedExecutions}
                unlimitedLabel={t("unlimited")}
                display={
                  isUnlimitedExecutions
                    ? `${totalExecutionsCount} · ${t("unlimited")}`
                    : t("usageOf", {
                        used: totalExecutionsCount,
                        limit: formatCompact(tierLimits.maxExecutionsPerMonth, locale),
                      })
                }
                hint={t("executionsHint")}
              />
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[13px] text-fg-muted">
                <Timer className="size-4 text-fg-subtle" aria-hidden /> {t("maxDuration")}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{formatDuration(tierLimits.maxExecutionDurationMs)}</p>
              <p className="mt-1 text-xs text-fg-subtle">{t("maxDurationHint")}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[13px] text-fg-muted">
                <Clock className="size-4 text-fg-subtle" aria-hidden /> {t("retentionQuota")}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t("days", { count: retentionDays })}</p>
              <p className="mt-1 text-xs text-fg-subtle">{t("retentionHint")}</p>
            </Card>
            <Card className="p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-[13px] text-fg-muted">{t("features.title")}</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  { label: t("features.customDomain"), on: tierLimits.allowCustomWebhookDomain },
                  { label: t("features.hardwareKms"), on: tierLimits.allowHardwareKms },
                ].map((f) => (
                  <li key={f.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-fg">{f.label}</span>
                    <span className={cn("inline-flex items-center gap-1 text-xs", f.on ? "text-fg-muted" : "text-fg-subtle")}>
                      {f.on ? <Check className="size-3.5 text-success" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                      {f.on ? t("features.included") : t("features.notIncluded")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>{t("teamMembers")}</CardTitle>
                <CardDescription>{t("teamHint")}</CardDescription>
              </div>
            </CardHeader>
            <ul className="divide-y divide-line">
              {roster.map((member) => {
                const isCurrent = session.email === member.email;
                const { name, title } = splitNameTitle(member.name);
                return (
                  <li
                    key={member.email}
                    className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", isCurrent && "bg-surface-2/50")}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-semibold text-fg">
                        {getInitials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                          {name}
                          {isCurrent && <Badge variant="accent">{t("you")}</Badge>}
                        </p>
                        <p className="truncate text-xs text-fg-subtle">
                          {title ? `${title} · ` : ""}
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-12 sm:pl-0">
                      <Badge variant="neutral">{tAccount(`roles.${member.role}`)}</Badge>
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={isCurrent || isPending}
                        onClick={() => switchRole(member.email as DemoEmail)}
                      >
                        {t("assumeRole")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <p className="text-[13px] text-fg-muted">{t("securityHint")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {SECURITY.map(({ key, icon: Icon, live }) => (
              <Card key={key} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold text-fg">{t(`security.${key}.title`)}</p>
                  </div>
                  <Badge variant={live ? "success" : "warning"} dot live={live}>
                    {t(`security.${key}.status`)}
                  </Badge>
                </div>
                <p className="mt-3 text-pretty text-[13px] leading-5 text-fg-muted">{t(`security.${key}.body`)}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Permissions */}
        <TabsContent value="permissions">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>{t("permissionsTitle")}</CardTitle>
                <CardDescription>{t("permissionsHint")}</CardDescription>
              </div>
            </CardHeader>

            {/* Desktop matrix */}
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/50 text-xs text-fg-subtle">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      {t("permission")}
                    </th>
                    {ROLES.map((role) => (
                      <th key={role} scope="col" className="px-3 py-2.5 text-center font-medium">
                        {tAccount(`roles.${role}`)}
                      </th>
                    ))}
                    <th scope="col" className="bg-accent/5 px-4 py-2.5 text-center font-medium text-fg">
                      {t("yourAccess")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PERMISSIONS.map((perm) => {
                    const mine = hasPermission(session.role, perm.key);
                    return (
                      <tr key={perm.key} className="transition-colors hover:bg-surface-2/40">
                        <th scope="row" className="px-5 py-3 text-left font-normal">
                          <span className="block font-medium text-fg">{t(`permissions.${perm.i18n}.label`)}</span>
                          <span className="block text-xs text-fg-subtle">{t(`permissions.${perm.i18n}.description`)}</span>
                        </th>
                        {ROLES.map((role) => (
                          <td key={role} className="px-3 py-3 text-center">
                            <PermissionMark allowed={hasPermission(role, perm.key)} allowedLabel={t("allowed")} deniedLabel={t("denied")} />
                          </td>
                        ))}
                        <td className="bg-accent/5 px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", mine ? "text-fg" : "text-fg-subtle")}>
                            <PermissionMark allowed={mine} allowedLabel={t("allowed")} deniedLabel={t("denied")} />
                            {mine ? t("allowed") : t("denied")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {PERMISSIONS.map((perm) => {
                const mine = hasPermission(session.role, perm.key);
                return (
                  <li key={perm.key} className="space-y-2.5 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-fg">{t(`permissions.${perm.i18n}.label`)}</p>
                        <p className="text-xs text-fg-subtle">{t(`permissions.${perm.i18n}.description`)}</p>
                      </div>
                      <Badge variant={mine ? "success" : "neutral"} dot>
                        {mine ? t("allowed") : t("denied")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.map((role) => {
                        const ok = hasPermission(role, perm.key);
                        return (
                          <span
                            key={role}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                              ok ? "border-line bg-surface-2 text-fg" : "border-dashed border-line text-fg-subtle"
                            )}
                          >
                            {ok ? <Check className="size-3 text-success" aria-hidden /> : <Minus className="size-3" aria-hidden />}
                            {tAccount(`roles.${role}`)}
                            <span className="sr-only">: {ok ? t("allowed") : t("denied")}</span>
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionMark({ allowed, allowedLabel, deniedLabel }: { allowed: boolean; allowedLabel: string; deniedLabel: string }) {
  return allowed ? (
    <Check className="mx-auto size-4 text-success" role="img" aria-label={allowedLabel} />
  ) : (
    <Minus className="mx-auto size-4 text-fg-subtle" role="img" aria-label={deniedLabel} />
  );
}
