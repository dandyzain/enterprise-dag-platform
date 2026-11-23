"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { spring } from "@/components/motion/presets";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Accessible name when the label is visually hidden / icon-only. */
  ariaLabel?: string;
  count?: number;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
  /** Unique id so the sliding pill animates within this control only. */
  layoutId?: string;
  disabled?: boolean;
}

/**
 * Segmented control (radiogroup) with a spring-animated selection pill and
 * roving arrow-key navigation.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
  iconOnly = false,
  className,
  layoutId,
  disabled = false,
}: SegmentedProps<T>) {
  const autoId = React.useId();
  const pillId = layoutId ?? `seg-${autoId}`;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function move(dir: 1 | -1, from: number) {
    const enabled = options.map((o, i) => (!o.disabled ? i : -1)).filter((i) => i >= 0);
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    if (next === undefined) return;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? opt.ariaLabel ?? String(opt.label) : opt.ariaLabel}
            tabIndex={active ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1, i);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1, i);
              }
            }}
            className={cn(
              "relative z-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium",
              "transition-colors duration-150 ease-standard disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              iconOnly && (size === "sm" ? "w-7 px-0" : "w-8 px-0"),
              "pointer-coarse:min-h-10",
              active ? "text-fg" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 -z-10 rounded-md border border-line bg-surface-3 shadow-elev-1"
                transition={spring.snappy}
              />
            )}
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            {!iconOnly && <span>{opt.label}</span>}
            {typeof opt.count === "number" && !iconOnly ? (
              <span className="rounded-full bg-surface-2 px-1.5 text-2xs tabular-nums text-fg-subtle">{opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
