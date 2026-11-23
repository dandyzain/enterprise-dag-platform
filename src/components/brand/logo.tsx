"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number | string;
  className?: string;
  animated?: boolean;
  title?: string;
}

/**
 * NexusFlow minimalist DAG logo mark — a diamond DAG (input → parallel tiers →
 * output) fused with an "N", in the emerald → cyan → blue signal gradient.
 * Gradient/filter IDs are generated per instance so multiple marks on one page
 * never collide.
 */
export function NexusLogoMark({ size = 28, className = "", animated = false, title }: LogoMarkProps) {
  const numSize = typeof size === "number" ? size : parseInt(size, 10) || 28;
  const uid = useId().replace(/:/g, "");
  const gradientId = `nx-grad-${uid}`;
  const glowId = `nx-glow-${uid}`;
  const bgId = `nx-bg-${uid}`;
  const shadowId = `nx-shadow-${uid}`;

  return (
    <svg
      width={numSize}
      height={numSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn(
        "shrink-0 transition-transform duration-300 ease-emphasized",
        animated && "group-hover:scale-105 group-hover:-rotate-3",
        className
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="55%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={glowId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={bgId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#18181B" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#10B981" floodOpacity="0.4" />
        </filter>
      </defs>

      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${bgId})`} stroke="#27272A" strokeWidth="1.2" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill={`url(#${glowId})`} />

      <g stroke={`url(#${gradientId})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 16L16 7.5" opacity="0.9" />
        <path d="M7.5 16L16 24.5" opacity="0.9" />
        <path d="M16 7.5L16 24.5" strokeDasharray="2 2" strokeWidth="1.2" opacity="0.4" />
        <path d="M7.5 16L24.5 16" strokeWidth="1.4" opacity="0.75" />
        <path d="M16 7.5L24.5 16" opacity="0.95" />
        <path d="M16 24.5L24.5 16" opacity="0.95" />
      </g>

      <circle cx="7.5" cy="16" r="2.2" fill="#10B981" filter={`url(#${shadowId})`} />
      <circle cx="7.5" cy="16" r="1" fill="#FFFFFF" />
      <circle cx="16" cy="7.5" r="2" fill="#06B6D4" />
      <circle cx="16" cy="7.5" r="0.9" fill="#FFFFFF" />
      <circle cx="16" cy="24.5" r="2" fill="#06B6D4" />
      <circle cx="16" cy="24.5" r="0.9" fill="#FFFFFF" />
      <circle cx="24.5" cy="16" r="2.4" fill="#3B82F6" filter={`url(#${shadowId})`} />
      <circle cx="24.5" cy="16" r="1.1" fill="#FFFFFF" />
    </svg>
  );
}

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showBadge?: boolean;
  badgeText?: string;
  subtitle?: string;
  animated?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { icon: 20, text: "text-sm" },
  sm: { icon: 24, text: "text-[15px]" },
  md: { icon: 28, text: "text-base" },
  lg: { icon: 36, text: "text-lg" },
  xl: { icon: 48, text: "text-2xl" },
} as const;

export function NexusLogo({
  size = "md",
  showText = true,
  showBadge = false,
  badgeText = "v1.0",
  subtitle,
  animated = true,
  className = "",
}: LogoProps) {
  const current = SIZE_MAP[size];

  return (
    <div className={cn("group flex min-w-0 select-none items-center gap-2.5", className)}>
      <div className="relative">
        <NexusLogoMark size={current.icon} animated={animated} />
        <div className="absolute inset-0 -z-10 rounded-lg bg-accent/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {showText && (
        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={cn("font-semibold tracking-tight text-fg", current.text)}>
              Nexus<span className="text-signal">Flow</span>
            </span>
            {showBadge && (
              <span className="shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs font-medium text-fg-muted">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 hidden truncate text-xs text-fg-subtle sm:block">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
