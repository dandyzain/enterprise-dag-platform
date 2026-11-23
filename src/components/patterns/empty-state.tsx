import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, actions, compact = false, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      {!compact && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-6 h-40 w-72 -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--signal-2) 16%, transparent), transparent)",
          }}
        />
      )}
      {Icon ? (
        <div
          className={cn(
            "relative flex items-center justify-center rounded-xl border border-line bg-surface-2 text-fg-muted shadow-elev-1",
            compact ? "size-9" : "size-12"
          )}
        >
          <Icon className={compact ? "size-4" : "size-5"} aria-hidden />
        </div>
      ) : null}
      <div className="relative max-w-sm space-y-1">
        <p className={cn("font-semibold text-fg", compact ? "text-sm" : "text-base")}>{title}</p>
        {description ? <p className="text-pretty text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="relative mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      {children}
    </div>
  );
}
