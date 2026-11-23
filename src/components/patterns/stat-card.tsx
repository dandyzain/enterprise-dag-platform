"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { NumberTicker } from "@/components/motion/number-ticker";
import { useSpotlight } from "@/components/motion/reveal";
import { Sparkline, type SparkPoint } from "./sparkline";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  /** Numeric values animate; strings render as-is. */
  value: number | string;
  decimals?: number;
  suffix?: string;
  locale?: string;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  delta?: { value: string; direction: "up" | "down"; good: boolean } | null;
  trend?: { data: SparkPoint[]; ariaLabel: string; formatPoint: (p: SparkPoint) => string };
  className?: string;
}

/**
 * Stat tile: label · value · (delta) · hint · optional sparkline.
 * Values stay in text tokens; colour lives only in the delta arrow and the
 * sparkline's current-period marker.
 */
export function StatCard({ label, value, decimals = 0, suffix, locale, hint, icon: Icon, delta, trend, className }: StatCardProps) {
  const onPointerMove = useSpotlight<HTMLDivElement>();

  return (
    <div
      onPointerMove={onPointerMove}
      className={cn(
        "spotlight group rounded-2xl border border-line bg-surface p-4 shadow-elev-1 transition-[border-color,transform] duration-200 ease-standard",
        "hover:border-line-strong",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-fg-muted">{label}</span>
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-subtle transition-colors group-hover:text-fg-muted">
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[28px] font-semibold leading-8 tracking-tight text-fg">
            {typeof value === "number" ? (
              <NumberTicker value={value} decimals={decimals} suffix={suffix} locale={locale} />
            ) : (
              value
            )}
          </div>
          <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
            {delta ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-fg-muted">
                {delta.direction === "up" ? (
                  <ArrowUpRight className={cn("size-3.5", delta.good ? "text-success" : "text-failed")} aria-hidden />
                ) : (
                  <ArrowDownRight className={cn("size-3.5", delta.good ? "text-success" : "text-failed")} aria-hidden />
                )}
                {delta.value}
              </span>
            ) : null}
            {hint ? <span className="truncate">{hint}</span> : null}
          </div>
        </div>
        {trend ? (
          <Sparkline
            data={trend.data}
            ariaLabel={trend.ariaLabel}
            formatPoint={trend.formatPoint}
            className="mb-1 h-10 w-24 shrink-0 sm:w-28"
          />
        ) : null}
      </div>
    </div>
  );
}
