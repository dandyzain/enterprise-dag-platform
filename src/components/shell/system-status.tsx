"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type State = "checking" | "operational" | "degraded" | "offline";

/** Real platform status from GET /api/health (polled every 60s). */
export function SystemStatus({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations("shell.status");
  const [state, setState] = React.useState<State>("checking");

  React.useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setState(!res.ok ? "offline" : json?.status === "healthy" ? "operational" : "degraded");
      } catch {
        if (!cancelled) setState("offline");
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dot = {
    checking: "bg-fg-subtle",
    operational: "bg-success",
    degraded: "bg-warning",
    offline: "bg-failed",
  }[state];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md text-xs text-fg-subtle",
        collapsed ? "justify-center" : "px-2.5"
      )}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        {state === "operational" && <span className={cn("absolute inset-0 rounded-full animate-live-ping", dot)} />}
        <span className={cn("relative size-2 rounded-full", dot)} />
      </span>
      <span className={cn("truncate", collapsed && "sr-only")}>{t(state)}</span>
    </div>
  );

  return collapsed ? (
    <Tooltip content={t(state)} side="right">
      {content}
    </Tooltip>
  ) : (
    content
  );
}
