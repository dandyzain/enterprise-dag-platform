"use client";

import React from "react";

interface LogoMarkProps {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

/**
 * NexusFlow Minimalist DAG Logo Mark
 * Designed with a geometric diamond DAG network (Input -> Parallel Execution Tiers -> Output Convergence)
 * seamlessly fused with the letter "N" (Nexus) and a radiant emerald-to-cyan gradient.
 */
export function NexusLogoMark({
  size = 28,
  className = "",
  animated = false,
}: LogoMarkProps) {
  const numSize = typeof size === "number" ? size : parseInt(size, 10) || 28;

  return (
    <svg
      width={numSize}
      height={numSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 ${
        animated ? "group-hover:scale-105 group-hover:rotate-1" : ""
      } ${className}`}
    >
      <defs>
        {/* Modern Vibrant Gradient: Emerald -> Teal -> Electric Cyan */}
        <linearGradient
          id="nexus-gradient"
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="55%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        <linearGradient
          id="nexus-glow"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.05" />
        </linearGradient>

        <linearGradient
          id="nexus-bg"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#18181B" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>

        {/* Subtle drop shadow filter for glowing nodes */}
        <filter id="nexus-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1"
            floodColor="#10B981"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Rounded squircle container with sleek border */}
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="url(#nexus-bg)"
        stroke="#27272A"
        strokeWidth="1.2"
      />
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        fill="url(#nexus-glow)"
      />

      {/* Directed DAG Edges (Nexus N Flow) */}
      <g stroke="url(#nexus-gradient)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Source -> Parallel Branches (Left to Upper & Lower) */}
        <path d="M7.5 16L16 7.5" opacity="0.9" />
        <path d="M7.5 16L16 24.5" opacity="0.9" />
        
        {/* Central Forward Flow Backbone (Forms dynamic N diagonal) */}
        <path d="M16 7.5L16 24.5" strokeDasharray="2 2" strokeWidth="1.2" opacity="0.4" />
        <path d="M7.5 16L24.5 16" strokeWidth="1.4" opacity="0.75" />

        {/* Branches -> Sink (Upper & Lower to Output) */}
        <path d="M16 7.5L24.5 16" opacity="0.95" />
        <path d="M16 24.5L24.5 16" opacity="0.95" />
      </g>

      {/* DAG Vertices (Nodes) */}
      {/* 1. Source Node (Left Input) */}
      <circle cx="7.5" cy="16" r="2.2" fill="#10B981" filter="url(#nexus-shadow)" />
      <circle cx="7.5" cy="16" r="1" fill="#FFFFFF" />

      {/* 2. Top Branch Node (Compute Task Tier 1) */}
      <circle cx="16" cy="7.5" r="2" fill="#06B6D4" />
      <circle cx="16" cy="7.5" r="0.9" fill="#FFFFFF" />

      {/* 3. Bottom Branch Node (Compute Task Tier 2) */}
      <circle cx="16" cy="24.5" r="2" fill="#06B6D4" />
      <circle cx="16" cy="24.5" r="0.9" fill="#FFFFFF" />

      {/* 4. Target Sink Node (Final Convergence Output) */}
      <circle cx="24.5" cy="16" r="2.4" fill="#3B82F6" filter="url(#nexus-shadow)" />
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

export function NexusLogo({
  size = "md",
  showText = true,
  showBadge = true,
  badgeText = "DAG v1.0",
  subtitle,
  animated = true,
  className = "",
}: LogoProps) {
  // Dimensions mapping
  const sizeMap = {
    xs: { icon: 20, text: "text-xs", badge: "text-[9px] px-1 py-0.2" },
    sm: { icon: 24, text: "text-sm", badge: "text-[10px] px-1.5 py-0.5" },
    md: { icon: 32, text: "text-base", badge: "text-[10px] px-1.5 py-0.5" },
    lg: { icon: 40, text: "text-lg", badge: "text-[11px] px-2 py-0.5" },
    xl: { icon: 48, text: "text-2xl", badge: "text-xs px-2.5 py-1" },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`group flex items-center gap-2.5 min-w-0 select-none ${className}`}>
      {/* Minimalist Vector Mark */}
      <div className="relative">
        <NexusLogoMark size={currentSize.icon} animated={animated} />
        {/* Soft ambient aura blur behind logo */}
        <div className="absolute inset-0 rounded-lg bg-emerald-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-bold tracking-tight text-zinc-100 ${currentSize.text}`}>
              Nexus<span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Flow</span>
            </span>
            {showBadge && (
              <span
                className={`font-mono font-medium rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0 ${currentSize.badge}`}
              >
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-zinc-400 font-normal tracking-normal truncate mt-0.5 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
