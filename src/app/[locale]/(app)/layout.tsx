import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { SIDEBAR_COOKIE } from "@/components/shell/nav-config";
import { getSessionCached, getWorkflowsCached, getWorkspacesCached } from "@/lib/ui/server-data";
import { isDemoMode } from "@/lib/config/env";

/**
 * Session-aware pages must render per request. getCurrentSession() swallows the
 * dynamic-usage signal from cookies(), which previously let Next prerender
 * these routes statically (signed-in users saw "Sign in" in production).
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([getSessionCached(), getLocale()]);
  // Server-side gate (the middleware only checks that a cookie exists).
  if (!session) redirect(`/${locale}/login`);

  const [workflows, workspaces, cookieStore] = await Promise.all([getWorkflowsCached(), getWorkspacesCached(), cookies()]);
  const initialCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      session={session}
      initialCollapsed={initialCollapsed}
      workflows={workflows.map((w) => ({ id: w.id, name: w.name, status: w.status }))}
      account={{ demoMode: isDemoMode(), workspaces }}
    >
      {children}
    </AppShell>
  );
}
