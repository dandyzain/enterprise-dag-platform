"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SparkPoint {
  label: string;
  value: number;
}

interface SparklineProps {
  data: SparkPoint[];
  /** Accessible name, e.g. "Runs per day, last 7 days". */
  ariaLabel: string;
  formatPoint: (p: SparkPoint) => string;
  className?: string;
}

const W = 120;
const H = 40;
const PAD = 5;

/**
 * Single-series trend: 2px line in the de-emphasis hue, ~10% area wash, the
 * current period marked in the accent with a 2px surface ring. Hover/focus
 * shows a crosshair + readout; arrow keys step through points.
 */
export function Sparkline({ data, ariaLabel, formatPoint, className }: SparklineProps) {
  const [active, setActive] = React.useState<number | null>(null);
  const uid = React.useId().replace(/:/g, "");

  if (data.length < 2) return null;

  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - PAD * 2) / (data.length - 1);
  const pts = data.map((d, i) => ({
    x: PAD + i * step,
    y: H - PAD - (d.value / max) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;
  const last = pts[pts.length - 1];
  const shown = active ?? data.length - 1;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round((x - PAD) / step))));
  }

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full overflow-visible outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        aria-label={`${ariaLabel}. ${formatPoint(data[shown])}`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setActive((a) => Math.max(0, (a ?? data.length - 1) - 1));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setActive((a) => Math.min(data.length - 1, (a ?? data.length - 1) + 1));
          }
        }}
      >
        <defs>
          <linearGradient id={`spark-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--fg-subtle)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--fg-subtle)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-${uid})`} />
        <path d={line} fill="none" stroke="var(--fg-subtle)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {active !== null && (
          <line
            x1={pts[active].x}
            x2={pts[active].x}
            y1={PAD - 2}
            y2={H - PAD}
            stroke="var(--line-strong)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {active !== null && active !== data.length - 1 && (
          <circle cx={pts[active].x} cy={pts[active].y} r={3.5} fill="var(--fg-muted)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )}
        <circle cx={last.x} cy={last.y} r={4} fill="var(--accent-solid)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-overlay px-2 py-1 text-xs text-fg shadow-elev-2"
          style={{ left: `${(pts[active].x / W) * 100}%` }}
          aria-hidden
        >
          {formatPoint(data[active])}
        </div>
      )}
    </div>
  );
}
