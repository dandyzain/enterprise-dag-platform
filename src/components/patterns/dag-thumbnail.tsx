import * as React from "react";
import { computeTiers, nodeKind, type GraphEdgeLike, type GraphNodeLike } from "@/lib/ui/graph";
import { cn } from "@/lib/utils";

const KIND_COLOR = {
  trigger: "var(--node-trigger)",
  webhook: "var(--node-webhook)",
  action: "var(--node-action)",
  filter: "var(--node-filter)",
} as const;

interface DagThumbnailProps {
  nodes: GraphNodeLike[];
  edges: GraphEdgeLike[];
  className?: string;
  ariaLabel?: string;
}

const COL = 76;
const ROW = 26;
const NW = 50;
const NH = 14;
const PAD = 12;

/**
 * Schematic, left-to-right preview of a workflow graph. Edges animate a
 * "signal" dash when the parent `.group` is hovered.
 */
export function DagThumbnail({ nodes, edges, className, ariaLabel }: DagThumbnailProps) {
  const tiers = computeTiers(nodes, edges);
  const pos = new Map<string, { x: number; y: number }>();
  const maxRows = Math.max(1, ...tiers.map((t) => t.length));
  const height = PAD * 2 + maxRows * ROW;
  const width = PAD * 2 + Math.max(1, tiers.length) * COL - (COL - NW);

  tiers.forEach((tier, col) => {
    const offset = (maxRows - tier.length) * (ROW / 2);
    tier.forEach((id, row) => {
      pos.set(id, { x: PAD + col * COL, y: PAD + offset + row * ROW + (ROW - NH) / 2 });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} role="img" aria-label={ariaLabel}>
        <div className="h-6 w-16 rounded-md border border-dashed border-line-strong" />
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <g fill="none" strokeWidth={1.25} strokeLinecap="round">
        {edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          const x1 = a.x + NW;
          const y1 = a.y + NH / 2;
          const x2 = b.x;
          const y2 = b.y + NH / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={e.id ?? i}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              className="stroke-line-strong transition-[stroke] duration-300 group-hover:animate-dash-flow group-hover:stroke-accent group-hover:[stroke-dasharray:4_3]"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
      {Array.from(pos.entries()).map(([id, p]) => {
        const node = byId.get(id);
        if (!node) return null;
        const color = KIND_COLOR[nodeKind(node)];
        return (
          <g key={id}>
            <rect
              x={p.x}
              y={p.y}
              width={NW}
              height={NH}
              rx={4}
              fill={color}
              fillOpacity={0.14}
              stroke={color}
              strokeOpacity={0.9}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={p.x + 7} cy={p.y + NH / 2} r={2.2} fill={color} />
            <rect x={p.x + 13} y={p.y + NH / 2 - 1.25} width={NW - 20} height={2.5} rx={1.25} fill="var(--fg-subtle)" opacity={0.5} />
          </g>
        );
      })}
    </svg>
  );
}
