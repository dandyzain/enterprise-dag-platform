import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badges keep text in neutral text tokens; identity/state is carried by a
 * coloured dot (never colour alone, never coloured small text).
 */
const badgeVariants = cva(
  "inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        neutral: "border-line bg-surface-2 text-fg-muted",
        outline: "border-line bg-transparent text-fg-muted",
        accent: "border-accent/25 bg-accent/10 text-accent",
        success: "border-line bg-surface-2 text-fg-muted",
        running: "border-line bg-surface-2 text-fg-muted",
        failed: "border-failed/30 bg-failed/10 text-fg",
        warning: "border-line bg-surface-2 text-fg-muted",
        trigger: "border-line bg-surface-2 text-fg-muted",
        webhook: "border-line bg-surface-2 text-fg-muted",
        schedule: "border-line bg-surface-2 text-fg-muted",
        action: "border-line bg-surface-2 text-fg-muted",
        transform: "border-line bg-surface-2 text-fg-muted",
        delay: "border-line bg-surface-2 text-fg-muted",
        filter: "border-line bg-surface-2 text-fg-muted",
        /* legacy alias */
        default: "border-accent/25 bg-accent/10 text-accent",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

const DOT_COLOR: Partial<Record<NonNullable<BadgeProps["variant"]>, string>> = {
  success: "bg-success",
  running: "bg-running",
  failed: "bg-failed",
  warning: "bg-warning",
  trigger: "bg-node-trigger",
  webhook: "bg-node-webhook",
  schedule: "bg-node-schedule",
  action: "bg-node-action",
  transform: "bg-node-transform",
  delay: "bg-node-delay",
  filter: "bg-node-filter",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show the tone dot. Defaults to true for status / node variants. */
  dot?: boolean;
  /** Animated "live" ring on the dot (running states). */
  live?: boolean;
}

export function Badge({ className, variant, dot, live, children, ...props }: BadgeProps) {
  const dotClass = variant ? DOT_COLOR[variant] : undefined;
  const showDot = dot ?? Boolean(dotClass);

  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {showDot && (
        <span className="relative flex size-1.5 shrink-0" aria-hidden>
          {live && (
            <span className={cn("absolute inset-0 rounded-full animate-live-ping", dotClass ?? "bg-fg-subtle")} />
          )}
          <span className={cn("relative size-1.5 rounded-full", dotClass ?? "bg-fg-subtle")} />
        </span>
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
