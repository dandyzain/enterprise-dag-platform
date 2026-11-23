import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/patterns/page-container";
import { TIER_LIMITS } from "@/lib/auth/rbac";
import { RETENTION_DAYS } from "@/lib/services/retention-service";
import { DEMO_USERS } from "@/lib/services/auth-service";
import { getExecutionsCached, getSessionCached, getWorkflowsCached } from "@/lib/ui/server-data";
import { SettingsClient, type SettingsTab } from "./settings-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsPage");
  return { title: t("metaTitle") };
}

const TABS: SettingsTab[] = ["overview", "team", "security", "permissions"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [session, locale, params] = await Promise.all([getSessionCached(), getLocale(), searchParams]);

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [workflows, executions] = await Promise.all([getWorkflowsCached(), getExecutionsCached()]);

  // Roster comes from the actual demo accounts so names match the role switcher.
  const roster = Object.entries(DEMO_USERS).map(([email, user]) => ({
    email,
    name: user.session.name,
    role: user.session.role,
  }));

  const initialTab = TABS.includes(params.tab as SettingsTab) ? (params.tab as SettingsTab) : "overview";

  return (
    <PageContainer>
      <SettingsClient
        session={session}
        activeWorkflowsCount={workflows.length}
        totalExecutionsCount={executions.length}
        tierLimits={TIER_LIMITS[session.workspaceTier]}
        retentionDays={RETENTION_DAYS[session.workspaceTier]}
        roster={roster}
        initialTab={initialTab}
      />
    </PageContainer>
  );
}
