"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/components/motion/presets";

interface MeterProps {
  label: string;
  value: number;
  max: number;
  /** Right-aligned readout, e.g. "3 of 25". */
  display: React.ReactNode;
  hint?: React.ReactNode;
  unlimited?: boolean;
  unlimitedLabel?: string;
  className?: string;
}

/**
 * Ratio against a limit. Fill carries severity (accent → warning → failed);
 * the track is a lighter step of the same hue so state reads across the bar.
 */
export function Meter({ label, value, max, display, hint, unlimited = false, unlimitedLabel, className }: MeterProps) {
  const ratio = unlimited || max <= 0 ? 0 : Math.min(1, value / max);
  const tone = ratio >= 0.9 ? "var(--failed)" : ratio >= 0.7 ? "var(--warning)" : "var(--accent-solid)";
  const pct = unlimited ? 0 : value > 0 ? Math.max(2, ratio * 100) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-fg-muted">{label}</span>
        <span className="font-medium tabular-nums text-fg">{display}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : max}
        aria-valuenow={value}
        aria-valuetext={unlimited ? unlimitedLabel : undefined}
        className="h-2 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${unlimited ? "var(--fg-subtle)" : tone} 18%, transparent)` }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: duration.deliberate * 1.6, ease: ease.emphasized }}
        />
      </div>
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
