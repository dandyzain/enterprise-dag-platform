import React from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { SIDEBAR_COOKIE } from "@/components/shell/nav-config";
import { getSessionCached, getWorkflowsCached } from "@/lib/ui/server-data";

/**
 * Session-aware pages must render per request. getCurrentSession() swallows the
 * dynamic-usage signal from cookies(), which previously let Next prerender
 * these routes statically (signed-in users saw "Sign in" in production).
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, workflows, cookieStore] = await Promise.all([getSessionCached(), getWorkflowsCached(), cookies()]);
  const initialCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      session={session}
      initialCollapsed={initialCollapsed}
      workflows={workflows.map((w) => ({ id: w.id, name: w.name, status: w.status }))}
    >
      {children}
    </AppShell>
  );
}
