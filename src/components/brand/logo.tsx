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
 * NexusFlow mark — minimalist.
 * A single continuous stroke draws an "N" that doubles as a flow: an input
 * node (bottom-left) travels up, across and up to an output node (top-right).
 * One shape, one gradient (the brand "signal"), no shadows or fine detail, so
 * it stays crisp down to 16px. Gradient IDs are unique per instance.
 */
export function NexusLogoMark({ size = 28, className = "", animated = false, title }: LogoMarkProps) {
  const numSize = typeof size === "number" ? size : parseInt(size, 10) || 28;
  const gradientId = `nx-${useId().replace(/:/g, "")}`;

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
        animated && "group-hover:scale-105",
        className
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="0.55" stopColor="#06B6D4" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M10.5 21.5V10.5L21.5 21.5V10.5"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="21.5" r="2.6" fill="#FFFFFF" />
      <circle cx="21.5" cy="10.5" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}

/** Single-colour wordmark; the gradient lives only in the mark. */
export function NexusWordmark({ className }: { className?: string }) {
  return <span className={cn("font-semibold tracking-tight text-fg", className)}>NexusFlow</span>;
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
      <NexusLogoMark size={current.icon} animated={animated} />
      {showText && (
        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <NexusWordmark className={current.text} />
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
