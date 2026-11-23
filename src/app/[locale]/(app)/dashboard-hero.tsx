"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Activity, ArrowRight, Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useSpotlight } from "@/components/motion/reveal";
import { useShell } from "@/components/shell/shell-context";
import { computeTiers, nodeKind, type GraphEdgeLike, type GraphNodeLike } from "@/lib/ui/graph";
import { cn } from "@/lib/utils";
import { ease } from "@/components/motion/presets";

/* ------------------------------------------------------------------------- */
/* Animated headline: words rise in with a soft blur, accent words in signal. */
/* ------------------------------------------------------------------------- */

interface Segment {
  text: string;
  accent?: boolean;
}

function AnimatedHeadline({ segments, id }: { segments: Segment[]; id?: string }) {
  const words = segments.flatMap((seg) =>
    seg.text
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ w, accent: seg.accent }))
  );

  return (
    <motion.h1
      id={id}
      className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-4xl lg:text-[44px]"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
    >
      {words.map(({ w, accent }, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <motion.span
            className={cn("inline-block will-change-transform", accent && "text-signal")}
            variants={{
              hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
              show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: ease.emphasized } },
            }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </motion.h1>
  );
}

/* ------------------------------------------------------------------------- */
/* Rotating word — screen readers get the static sentence instead.            */
/* ------------------------------------------------------------------------- */

function RotatingText({ lead, words }: { lead: string; words: string[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, [reduce, words.length]);

  return (
    <p className="text-pretty text-base leading-7 text-fg-muted sm:text-lg">
      <span className="sr-only">
        {lead} {words.join(", ")}.
      </span>
      <span aria-hidden>
        {lead}{" "}
        <span className="relative inline-grid align-bottom">
          {/* Invisible longest word reserves width → no layout shift while rotating. */}
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap font-medium">
            {words.reduce((a, b) => (b.length > a.length ? b : a), "")}
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={words[index]}
              className="col-start-1 row-start-1 whitespace-nowrap font-medium text-fg"
              initial={{ opacity: 0, y: "60%", filter: "blur(6px)" }}
              animate={{ opacity: 1, y: "0%", filter: "blur(0px)" }}
              exit={{ opacity: 0, y: "-60%", filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: ease.emphasized }}
            >
              {words[index]}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------------- */
/* Live preview: the latest workflow "runs" on a loop, tier by tier.          */
/* ------------------------------------------------------------------------- */

const KIND_COLOR = {
  trigger: "var(--node-trigger)",
  webhook: "var(--node-webhook)",
  schedule: "var(--node-schedule)",
  action: "var(--node-action)",
  transform: "var(--node-transform)",
  delay: "var(--node-delay)",
  filter: "var(--node-filter)",
} as const;

const DEMO_NODES: GraphNodeLike[] = [
  { id: "a", data: { type: "webhook", label: "Stripe webhook" } },
  { id: "b", data: { type: "action", label: "Enrich customer" } },
  { id: "c", data: { type: "filter", label: "High value?" } },
  { id: "d", data: { type: "action", label: "Post to ledger" } },
];
const DEMO_EDGES: GraphEdgeLike[] = [
  { source: "a", target: "b" },
  { source: "a", target: "c" },
  { source: "b", target: "d" },
  { source: "c", target: "d" },
];

const NW = 140;
const NH = 42;
const COL = 168;
const ROW = 62;
const STAIR = 34;
const PAD = 16;
const MAX_NODES = 8;

function truncate(text: string, max = 15) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

type NodeState = "pending" | "running" | "success";

function HeroGraph({
  nodes: rawNodes,
  edges: rawEdges,
  name,
}: {
  nodes: GraphNodeLike[];
  edges: GraphEdgeLike[];
  name: string;
}) {
  const t = useTranslations("dashboard.hero");
  const reduce = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { margin: "-10% 0px" });
  const uid = React.useId().replace(/:/g, "");

  // Lay out the real graph (capped for legibility), falling back to a demo graph.
  const { nodes, edges, tiers, pos, width, height } = React.useMemo(() => {
    const useReal = rawNodes.length >= 2;
    let n = useReal ? rawNodes : DEMO_NODES;
    let e = useReal ? rawEdges : DEMO_EDGES;
    let tiers = computeTiers(n, e);
    if (n.length > MAX_NODES) {
      const keep = new Set<string>();
      const kept: string[][] = [];
      for (const tier of tiers) {
        const room = MAX_NODES - keep.size;
        if (room <= 0) break;
        const slice = tier.slice(0, room);
        slice.forEach((id) => keep.add(id));
        kept.push(slice);
      }
      tiers = kept;
      n = n.filter((x) => keep.has(x.id));
      e = e.filter((x) => keep.has(x.source) && keep.has(x.target));
    }
    const maxRows = Math.max(1, ...tiers.map((tier) => tier.length));
    // Linear flows read better as a gentle descending staircase than a flat line.
    const linear = maxRows === 1;
    const pos = new Map<string, { x: number; y: number; tier: number }>();
    tiers.forEach((tier, col) => {
      const offset = linear ? col * STAIR : ((maxRows - tier.length) * ROW) / 2;
      tier.forEach((id, row) => pos.set(id, { x: PAD + col * COL, y: PAD + 6 + offset + row * ROW, tier: col }));
    });
    return {
      nodes: n,
      edges: e,
      tiers,
      pos,
      width: PAD * 2 + (tiers.length - 1) * COL + NW + 6,
      height: PAD * 2 + 6 + (linear ? (tiers.length - 1) * STAIR : (maxRows - 1) * ROW) + NH,
    };
  }, [rawNodes, rawEdges]);

  // phase: -1 idle → 0..T-1 running tier → T..T+2 hold "all done" → loop.
  const T = tiers.length;
  const [phase, setPhase] = React.useState(-1);
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    if (reduce) {
      setPhase(T);
      return;
    }
    if (!inView) return;
    const id = setInterval(() => {
      setPhase((p) => {
        if (p >= T + 2) {
          setCycle((c) => c + 1);
          return -1;
        }
        return p + 1;
      });
    }, 950);
    return () => clearInterval(id);
  }, [reduce, inView, T]);

  const stateOf = (tier: number): NodeState => {
    if (phase < 0) return "pending";
    if (phase >= T || tier < phase) return "success";
    return tier === phase ? "running" : "pending";
  };

  const total = nodes.length;
  const done = tiers.slice(0, Math.max(0, Math.min(phase, T))).reduce((acc, tier) => acc + tier.length, 0);
  const statusText =
    phase < 0 ? t("queued") : phase >= T ? t("done", { total }) : t("running", { current: done + 1, total });

  // Pointer tilt (fine pointers only, disabled under reduced motion).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 140, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 140, damping: 18 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative [perspective:1000px]"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: ease.emphasized }}
        className="relative rounded-2xl border border-line bg-app/70 p-3 shadow-elev-3 backdrop-blur-md"
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between gap-3 px-1.5 pb-2.5" aria-hidden>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <span className="truncate font-mono text-2xs text-fg-subtle">{truncate(name, 34)}</span>
          <span className="flex items-center gap-1.5 text-2xs font-medium text-fg-subtle">
            <span className="relative flex size-1.5">
              {phase >= 0 && phase < T && <span className="absolute inset-0 animate-live-ping rounded-full bg-running" />}
              <span className={cn("relative size-1.5 rounded-full", phase >= 0 && phase < T ? "bg-running" : "bg-success")} />
            </span>
            {t("previewTitle")}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface/80 bg-dot-grid">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={t("previewLabel", { name })}
          >
            <defs>
              <linearGradient id={`hero-signal-${uid}`} x1="0" x2="1">
                <stop offset="0%" stopColor="var(--signal-1)" />
                <stop offset="55%" stopColor="var(--signal-2)" />
                <stop offset="100%" stopColor="var(--signal-3)" />
              </linearGradient>
            </defs>

            {/* Edges: base line, completed overlay draws in, running pulse travels. */}
            {edges.map((edge, i) => {
              const a = pos.get(edge.source);
              const b = pos.get(edge.target);
              if (!a || !b) return null;
              const x1 = a.x + NW;
              const y1 = a.y + NH / 2;
              const x2 = b.x;
              const y2 = b.y + NH / 2;
              const mid = (x1 + x2) / 2;
              const d = `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
              const target = stateOf(b.tier);
              const lit = target !== "pending";
              return (
                <g key={`${edge.source}-${edge.target}-${i}`}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth={1.5}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, delay: 0.5 + i * 0.08, ease: ease.emphasized }}
                  />
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={`url(#hero-signal-${uid})`}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    initial={false}
                    animate={{ pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
                    transition={{ duration: lit ? 0.6 : 0.25, ease: ease.emphasized }}
                  />
                  {target === "running" && !reduce && (
                    <circle key={`pulse-${cycle}-${phase}`} r={4} fill="var(--running)" opacity={0.95}>
                      <animateMotion dur="0.9s" repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node, i) => {
              const p = pos.get(node.id);
              if (!p) return null;
              const state = stateOf(p.tier);
              const color = KIND_COLOR[nodeKind(node)];
              const label = truncate(node.data?.label || node.id);
              const cy = p.y + NH / 2;
              const bx = p.x + NW - 3;
              const by = p.y + 3;
              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.09, ease: ease.emphasized }}
                >
                  {/* Running glow */}
                  <motion.rect
                    x={p.x - 3}
                    y={p.y - 3}
                    width={NW + 6}
                    height={NH + 6}
                    rx={13}
                    fill="none"
                    stroke="var(--running)"
                    strokeWidth={2}
                    initial={false}
                    animate={{ opacity: state === "running" ? [0.25, 0.9, 0.25] : 0 }}
                    transition={state === "running" ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                  />
                  <rect
                    x={p.x}
                    y={p.y}
                    width={NW}
                    height={NH}
                    rx={10}
                    fill="var(--surface)"
                    stroke={state === "success" ? "color-mix(in oklab, var(--success) 55%, var(--line))" : "var(--line-strong)"}
                    strokeWidth={1}
                    style={{ transition: "stroke 300ms" }}
                  />
                  <rect x={p.x} y={p.y + 9} width={3} height={NH - 18} rx={1.5} fill={color} />
                  <circle cx={p.x + 18} cy={cy} r={4.5} fill={color} />
                  <text
                    x={p.x + 28}
                    y={cy + 4}
                    fontSize={12.5}
                    fontWeight={500}
                    fill="var(--fg)"
                    style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                  >
                    {label}
                  </text>

                  {/* Status mark */}
                  {/* Corner status badge — 2px surface ring keeps it legible over the border */}
                  <circle cx={bx} cy={by} r={9} fill="var(--surface)" />
                  {state === "pending" && (
                    <circle cx={bx} cy={by} r={6} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeDasharray="2.5 2.5" />
                  )}
                  {state === "running" && (
                    <g>
                      <circle cx={bx} cy={by} r={6} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
                      <motion.circle
                        cx={bx}
                        cy={by}
                        r={6}
                        fill="none"
                        stroke="var(--running)"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeDasharray="10 28"
                        animate={reduce ? undefined : { rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                      />
                    </g>
                  )}
                  {state === "success" && (
                    <g>
                      <circle cx={bx} cy={by} r={7} fill="var(--success)" />
                      <motion.path
                        key={`check-${cycle}`}
                        d={`M${bx - 3.2},${by + 0.2} L${bx - 0.8},${by + 2.6} L${bx + 3.4},${by - 2.4}`}
                        fill="none"
                        stroke="var(--surface)"
                        strokeWidth={1.9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: reduce ? 1 : 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35, ease: ease.emphasized }}
                      />
                    </g>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Progress + caption */}
        <div className="mt-3 flex items-center gap-3 px-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-signal"
              initial={false}
              animate={{ width: `${phase < 0 ? 0 : (Math.min(done + (phase < T ? 0.5 : 0), total) / total) * 100}%` }}
              transition={{ duration: 0.6, ease: ease.emphasized }}
            />
          </div>
          <div className="relative h-4 w-44 overflow-hidden text-right text-xs text-fg-subtle" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={statusText}
                className="absolute inset-0 truncate"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.18, ease: ease.emphasized }}
              >
                {statusText}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Soft floor reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 -bottom-6 h-10 rounded-full opacity-60 blur-2xl"
        style={{ background: "color-mix(in oklab, var(--signal-2) 30%, transparent)" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Hero                                                                        */
/* ------------------------------------------------------------------------- */

interface DashboardHeroProps {
  firstName: string | null;
  runs7d: number;
  preview: { name: string; nodes: GraphNodeLike[]; edges: GraphEdgeLike[] } | null;
}

export function DashboardHero({ firstName, runs7d, preview }: DashboardHeroProps) {
  const t = useTranslations("dashboard");
  const { setNewWorkflowOpen } = useShell();
  const reduce = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);
  const onPointerMove = useSpotlight<HTMLElement>();
  const rotating = t.raw("hero.rotating") as string[];

  const segments: Segment[] = firstName
    ? [{ text: t("hero.greeting") }, { text: firstName, accent: true }]
    : [{ text: t("hero.greetingGuest") }, { text: "NexusFlow", accent: true }];

  // Ambient blobs only drift while the hero is on screen.
  const drift = inView && !reduce ? "" : "paused";

  return (
    <section
      ref={sectionRef}
      onPointerMove={onPointerMove}
      aria-labelledby="hero-heading"
      className="spotlight relative overflow-hidden rounded-3xl border border-line bg-surface/60 shadow-elev-2"
    >
      {/* Animated backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className={cn("absolute -left-32 -top-40 size-[30rem] rounded-full opacity-60 blur-3xl will-change-transform animate-aurora-a", drift)}
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--signal-1) 32%, transparent), transparent)" }}
        />
        <div
          className={cn("absolute -right-24 -top-16 size-[26rem] rounded-full opacity-55 blur-3xl will-change-transform animate-aurora-b", drift)}
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--signal-3) 30%, transparent), transparent)" }}
        />
        <div
          className={cn("absolute -bottom-48 left-1/3 size-[24rem] rounded-full opacity-50 blur-3xl will-change-transform animate-aurora-c", drift)}
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--signal-2) 28%, transparent), transparent)" }}
        />
        <div className="absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_75%_45%,black_15%,transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[color-mix(in_oklab,var(--signal-2)_60%,transparent)] to-transparent" />
      </div>

      <div className="relative grid items-center gap-10 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:p-10 xl:p-12">
        <div className="min-w-0 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.emphasized }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-overlay/70 py-1 pl-2 pr-3 text-xs font-medium text-fg-muted shadow-elev-1 backdrop-blur"
          >
            <span className="relative flex size-2">
              {runs7d > 0 && <span className="absolute inset-0 animate-live-ping rounded-full bg-success" />}
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            {runs7d > 0 ? t("hero.liveRuns", { count: runs7d }) : t("hero.ready")}
          </motion.div>

          <div className="space-y-4">
            <AnimatedHeadline id="hero-heading" segments={segments} />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: ease.emphasized }}
            >
              <RotatingText lead={t("hero.lead")} words={rotating} />
            </motion.div>
          </div>

          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: ease.emphasized }}
          >
            <Button size="lg" onClick={() => setNewWorkflowOpen(true)} className="group shine overflow-hidden shadow-elev-2">
              <Plus className="transition-transform duration-300 group-hover:rotate-90" aria-hidden />
              {t("newWorkflow")}
            </Button>
            <Button asChild size="lg" variant="secondary" className="group">
              <Link href="/executions">
                <Activity aria-hidden /> {t("viewRuns")}
                <ArrowRight className="-ml-0.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </Button>
          </motion.div>
        </div>

        <div className="hidden min-w-0 sm:block">
          <HeroGraph
            name={preview?.name ?? "NexusFlow"}
            nodes={preview?.nodes ?? []}
            edges={preview?.edges ?? []}
          />
        </div>
      </div>
    </section>
  );
}
