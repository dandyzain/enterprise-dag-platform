"use client";

import * as React from "react";
import { useFormatter, useNow } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  date: Date | string | number;
  className?: string;
  /** Show absolute date/time in a tooltip (default true). */
  tooltip?: boolean;
}

/** "3 minutes ago", auto-refreshing, with the absolute timestamp on hover/focus. */
export function RelativeTime({ date, className, tooltip = true }: RelativeTimeProps) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const d = React.useMemo(() => new Date(date), [date]);
  if (Number.isNaN(d.getTime())) return <span className={className}>—</span>;

  const absolute = format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const node = (
    <time
      dateTime={d.toISOString()}
      className={cn("whitespace-nowrap", className)}
      suppressHydrationWarning
      tabIndex={tooltip ? 0 : undefined}
    >
      {format.relativeTime(d, now)}
    </time>
  );

  return tooltip ? <Tooltip content={absolute}>{node}</Tooltip> : node;
}
