"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { spring } from "@/components/motion/presets";
import { NAV_ITEMS, isActivePath } from "./nav-config";

/** Persistent bottom navigation for phones (< md). */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("main")}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-overlay/90 backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-fg" : "text-fg-subtle active:text-fg-muted"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-signal"
                    transition={spring.snappy}
                  />
                )}
                <Icon className="size-5" aria-hidden />
                <span>{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
