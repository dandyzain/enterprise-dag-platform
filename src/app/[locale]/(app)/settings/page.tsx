import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/patterns/page-container";
import { TIER_LIMITS, hasPermission } from "@/lib/auth/rbac";
import { RETENTION_DAYS } from "@/lib/services/retention-service";
import { listMembers, listInvitations } from "@/lib/services/workspace-service";
import { listAuditLogs } from "@/lib/services/audit-service";
import { getUsage } from "@/lib/services/dispatch-service";
import { isDemoMode } from "@/lib/config/env";
import { isDemoUserId } from "@/lib/auth/demo";
import { getSessionCached, getWorkflowsCached } from "@/lib/ui/server-data";
import { SettingsClient } from "./settings-client";
import { SETTINGS_TABS, type SettingsTab } from "./tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsPage");
  return { title: t("metaTitle") };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [session, locale, params] = await Promise.all([getSessionCached(), getLocale(), searchParams]);

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const canManageMembers = hasPermission(session.role, "member:manage");
  const canViewAudit = hasPermission(session.role, "audit:view");

  const [workflows, usage, members, invitations, audit] = await Promise.all([
    getWorkflowsCached(),
    getUsage(session.workspaceId, session.workspaceTier),
    listMembers(session.workspaceId),
    canManageMembers ? listInvitations(session.workspaceId) : Promise.resolve([]),
    canViewAudit ? listAuditLogs(session.workspaceId, 150) : Promise.resolve([]),
  ]);

  const initialTab = SETTINGS_TABS.includes(params.tab as SettingsTab) ? (params.tab as SettingsTab) : "overview";

  return (
    <PageContainer>
      <SettingsClient
        session={session}
        demoMode={isDemoMode()}
        isDemoPersona={isDemoUserId(session.id)}
        activeWorkflowsCount={workflows.length}
        executionsThisMonth={usage.executionsThisMonth}
        tierLimits={TIER_LIMITS[session.workspaceTier]}
        retentionDays={RETENTION_DAYS[session.workspaceTier]}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
        invitations={invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
        audit={audit.map((a) => ({
          id: a.id,
          action: a.action,
          actorEmail: a.actorEmail,
          targetType: a.targetType,
          targetId: a.targetId,
          metadata: a.metadata,
          createdAt: a.createdAt.toISOString(),
        }))}
        initialTab={initialTab}
      />
    </PageContainer>
  );
}
