"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { duration, ease } from "./presets";

interface NumberTickerProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  locale?: string;
  className?: string;
}

/** Counts up once when scrolled into view (instant under reduced motion). */
export function NumberTicker({ value, decimals = 0, suffix = "", prefix = "", locale = "en", className }: NumberTickerProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();

  const format = React.useCallback(
    (n: number) =>
      `${prefix}${n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
    [decimals, locale, prefix, suffix]
  );

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || !inView) {
      if (reduce) node.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration: duration.deliberate * 2,
      ease: ease.emphasized,
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, format]);

  // Server + first paint render the final value (no layout shift, correct for no-JS).
  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {format(value)}
    </span>
  );
}
