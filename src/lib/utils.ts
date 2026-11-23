import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge doesn't know our design-token scales, so register them to make
 * sure e.g. `shadow-elev-2` and `text-2xs` merge/override correctly.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["elev-1", "elev-2", "elev-3"],
      text: ["2xs"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Two-letter initials from a display name ("Alex Vance (Lead)" → "AV"). */
export function getInitials(name: string): string {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Splits "Alex Vance (Lead Architect)" into name + title. */
export function splitNameTitle(name: string): { name: string; title?: string } {
  const match = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!match) return { name: name.trim() };
  return { name: match[1].trim(), title: match[2].trim() };
}

/** Human-friendly duration: 840 → "840ms", 4210 → "4.2s", 75000 → "1m 15s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Compact number for stat tiles: 1284 → "1,284", 12900 → "12.9K". */
export function formatCompact(value: number, locale = "en"): string {
  if (Math.abs(value) < 10_000) return value.toLocaleString(locale);
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
