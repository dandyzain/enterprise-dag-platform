/**
 * Motion tokens — the single source of truth for every animation in the app.
 * Mirrors the CSS tokens in globals.css (--ease-*, durations).
 *
 * Principles: motion explains state; idle decoration never loops; only
 * transform/opacity animate; reduced-motion is honoured globally via
 * <MotionConfig reducedMotion="user"> plus a CSS fallback.
 */

export const duration = {
  instant: 0.1,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  deliberate: 0.48,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 35, mass: 0.8 },
  gentle: { type: "spring", stiffness: 260, damping: 30 },
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.emphasized },
  },
} as const;

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: ease.standard } },
} as const;

export function staggerContainer(stagger = 0.04, delayChildren = 0) {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  } as const;
}
