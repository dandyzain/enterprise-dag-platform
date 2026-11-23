"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { NexusLogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { UserNav } from "@/components/auth/user-nav";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import type { SessionUser } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { spring } from "@/components/motion/presets";
import { NAV_ITEMS, isActivePath, SIDEBAR_COOKIE } from "./nav-config";
import { SystemStatus } from "./system-status";
import { useShell } from "./shell-context";

interface SidebarProps {
  session: SessionUser | null;
  initialCollapsed: boolean;
}

/**
 * Desktop: 248px sidebar, collapsible to a 68px rail (persisted in a cookie so
 * the server renders the right width — no layout shift). Tablet: rail only.
 */
export function Sidebar({ session, initialCollapsed }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { setNewWorkflowOpen } = useShell();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const isLg = useMediaQuery(BREAKPOINTS.lg, true);
  const rail = collapsed || !isLg;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Labels are hidden by CSS below lg so SSR output matches every viewport.
  const labelClass = collapsed ? "sr-only" : "sr-only lg:not-sr-only";

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/60 md:flex",
        "transition-[width] duration-300 ease-emphasized",
        collapsed ? "w-[68px]" : "w-[68px] lg:w-[248px]"
      )}
    >
      <div className={cn("flex h-14 items-center gap-2.5 px-4", collapsed ? "justify-center" : "justify-center lg:justify-start")}>
        <Link href="/" aria-label={t("home")} className="group flex items-center gap-2.5 rounded-lg">
          <NexusLogoMark size={28} animated />
          <span className={cn("text-[15px] font-semibold tracking-tight text-fg", labelClass)}>
            Nexus<span className="text-signal">Flow</span>
          </span>
        </Link>
      </div>

      <div className="px-3 pt-2">
        <Tooltip content={t("newWorkflow")} side="right" enabled={rail}>
          <Button
            onClick={() => setNewWorkflowOpen(true)}
            className={cn("w-full", rail && "px-0")}
            aria-label={rail ? t("newWorkflow") : undefined}
          >
            <Plus aria-hidden />
            <span className={labelClass}>{t("newWorkflow")}</span>
          </Button>
        </Tooltip>
      </div>

      <nav aria-label={t("main")} className="mt-5 flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Tooltip content={t(item.key)} side="right" enabled={rail}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={rail ? t(item.key) : undefined}
                    className={cn(
                      "relative isolate flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150",
                      rail && "justify-center px-0",
                      active ? "text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 -z-10 rounded-lg border border-line bg-surface-3 shadow-elev-1"
                        transition={spring.snappy}
                      />
                    )}
                    {active && (
                      <motion.span
                        layoutId="sidebar-active-bar"
                        className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-signal"
                        transition={spring.snappy}
                      />
                    )}
                    <Icon className={cn("size-4 shrink-0", active ? "text-fg" : "text-fg-subtle")} aria-hidden />
                    <span className={labelClass}>{t(item.key)}</span>
                  </Link>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-line px-3 py-3">
        <SystemStatus collapsed={rail} />
        <Tooltip content={collapsed ? t("expand") : t("collapse")} side="right">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? t("expand") : t("collapse")}
            aria-expanded={!collapsed}
            className={cn(
              "hidden h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:flex",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            <span className={labelClass}>{collapsed ? t("expand") : t("collapse")}</span>
          </button>
        </Tooltip>
        <div className="pt-1">
          <UserNav session={session} variant="sidebar" collapsed={rail} align="start" side="right" />
        </div>
      </div>
    </aside>
  );
}
