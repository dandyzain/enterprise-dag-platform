"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { SessionUser } from "@/lib/services/auth-service";
import { ShellProvider, useShell } from "./shell-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileTabBar } from "./mobile-tab-bar";
import { CommandMenu, type CommandWorkflow } from "./command-menu";
import { NewWorkflowDialog } from "./new-workflow-dialog";
import { AccountProvider, type AccountContextValue } from "./account-context";

interface AppShellProps {
  session: SessionUser | null;
  workflows: CommandWorkflow[];
  initialCollapsed: boolean;
  account: AccountContextValue;
  children: React.ReactNode;
}

function ShellOverlays({ session, workflows }: { session: SessionUser | null; workflows: CommandWorkflow[] }) {
  const { newWorkflowOpen, setNewWorkflowOpen } = useShell();
  return (
    <>
      <CommandMenu session={session} workflows={workflows} />
      <NewWorkflowDialog open={newWorkflowOpen} onOpenChange={setNewWorkflowOpen} />
    </>
  );
}

export function AppShell({ session, workflows, initialCollapsed, account, children }: AppShellProps) {
  const t = useTranslations("ui");
  return (
    <AccountProvider value={account}>
    <ShellProvider>
      <a
        href="#main"
        className="sr-only z-[100] rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-accent-solid-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar session={session} initialCollapsed={initialCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar session={session} />
          <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-0">
            {children}
          </main>
        </div>
      </div>
      <MobileTabBar />
      <ShellOverlays session={session} workflows={workflows} />
    </ShellProvider>
    </AccountProvider>
  );
}

