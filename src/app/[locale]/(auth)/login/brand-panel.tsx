"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Activity, GitBranch, ShieldCheck } from "lucide-react";
import { NexusLogo } from "@/components/brand/logo";
import { fadeUp, staggerContainer } from "@/components/motion/presets";

/* A tiny illustrative DAG: trigger → (action, filter) → action */
const NODES = [
  { id: "a", x: 40, y: 150, label: "Trigger", color: "var(--node-trigger)" },
  { id: "b", x: 220, y: 70, label: "Enrich", color: "var(--node-action)" },
  { id: "c", x: 220, y: 230, label: "Filter", color: "var(--node-filter)" },
  { id: "d", x: 400, y: 150, label: "Notify", color: "var(--node-webhook)" },
];
const EDGES = [
  ["a", "b"],
  ["a", "c"],
  ["b", "d"],
  ["c", "d"],
] as const;
const NW = 120;
const NH = 40;

function edgePath(from: (typeof NODES)[number], to: (typeof NODES)[number]) {
  const x1 = from.x + NW;
  const y1 = from.y + NH / 2;
  const x2 = to.x;
  const y2 = to.y + NH / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

function SignalFlow() {
  const reduce = useReducedMotion();
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <svg viewBox="0 0 560 310" className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="login-signal" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--signal-1)" />
          <stop offset="55%" stopColor="var(--signal-2)" />
          <stop offset="100%" stopColor="var(--signal-3)" />
        </linearGradient>
      </defs>
      {EDGES.map(([f, t], i) => {
        const d = edgePath(byId[f], byId[t]);
        return (
          <g key={`${f}${t}`}>
            <path d={d} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
            <motion.path
              d={d}
              fill="none"
              stroke="url(#login-signal)"
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.3 + i * 0.18, ease: [0.16, 1, 0.3, 1] }}
            />
            {!reduce && (
              <circle r={3.5} fill="var(--signal-2)" opacity={0}>
                <set attributeName="opacity" to="1" begin={`${1.4 + i * 0.35}s`} />
                <animateMotion dur="2.6s" begin={`${1.4 + i * 0.35}s`} repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        );
      })}
      {NODES.map((n, i) => (
        <motion.g
          key={n.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect x={n.x} y={n.y} width={NW} height={NH} rx={10} fill="var(--surface)" stroke="var(--line-strong)" />
          <rect x={n.x} y={n.y + 8} width={3} height={NH - 16} rx={1.5} fill={n.color} />
          <circle cx={n.x + 22} cy={n.y + NH / 2} r={5} fill={n.color} opacity={0.9} />
          <text x={n.x + 36} y={n.y + NH / 2 + 4} fontSize={13} fontWeight={500} fill="var(--fg)" fontFamily="var(--font-geist-sans)">
            {n.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

export function BrandPanel() {
  const t = useTranslations("auth");
  const points = [
    { icon: GitBranch, text: t("points.visual") },
    { icon: Activity, text: t("points.live") },
    { icon: ShieldCheck, text: t("points.vault") },
  ];

  return (
    <aside className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col">
      <div className="absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-[28rem] w-[36rem] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--signal-1) 20%, transparent), transparent), radial-gradient(closest-side, color-mix(in oklab, var(--signal-3) 14%, transparent), transparent)",
        }}
      />
      <div className="relative flex h-16 items-center px-10">
        <NexusLogo size="sm" />
      </div>
      <motion.div
        className="relative flex flex-1 flex-col justify-center gap-10 px-10 pb-16 xl:px-16"
        initial="hidden"
        animate="show"
        variants={staggerContainer(0.08, 0.1)}
      >
        <motion.div variants={fadeUp} className="max-w-lg space-y-3">
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-fg xl:text-[44px]">
            {t("brandTitle")}
          </h2>
          <p className="text-pretty text-base leading-7 text-fg-muted">{t("brandSubtitle")}</p>
        </motion.div>
        <motion.div variants={fadeUp} className="max-w-xl rounded-2xl border border-line bg-app/60 p-4 shadow-elev-2 backdrop-blur">
          <SignalFlow />
        </motion.div>
        <motion.ul variants={fadeUp} className="space-y-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-fg-muted">
              <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
                <Icon className="size-3.5" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </aside>
  );
}
