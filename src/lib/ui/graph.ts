/**
 * Pure, presentation-only graph helpers (no business logic). Used by the DAG
 * thumbnails, the run timeline and the inspector's variable helper.
 */

export interface GraphNodeLike {
  id: string;
  type?: string;
  data?: { type?: string; label?: string };
}

export interface GraphEdgeLike {
  id?: string;
  source: string;
  target: string;
}

/** Longest-path depth from any root; tolerant of cycles (visits each node once). */
export function computeTiers(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): string[][] {
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    outgoing.get(e.source)!.push(e.target);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    if ((incoming.get(n.id) ?? 0) === 0) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  const remaining = new Map(incoming);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of outgoing.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(id) ?? 0) + 1));
      remaining.set(next, (remaining.get(next) ?? 1) - 1);
      if (remaining.get(next) === 0) queue.push(next);
    }
  }

  // Nodes stuck in a cycle get placed after everything else.
  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  }

  const tiers: string[][] = [];
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    (tiers[d] ??= []).push(n.id);
  }
  return tiers.filter(Boolean);
}

/** All ancestors of a node (nodes whose output can flow into it). */
export function getAncestorIds(nodeId: string, edges: GraphEdgeLike[]): string[] {
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    (parents.get(e.target) ?? parents.set(e.target, []).get(e.target)!).push(e.source);
  }
  const seen = new Set<string>();
  const stack = [...(parents.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || id === nodeId) continue;
    seen.add(id);
    stack.push(...(parents.get(id) ?? []));
  }
  return Array.from(seen);
}

export type NodeKind = "trigger" | "webhook" | "schedule" | "action" | "transform" | "delay" | "filter";

const NODE_KINDS: NodeKind[] = ["trigger", "webhook", "schedule", "action", "transform", "delay", "filter"];

export function nodeKind(node: GraphNodeLike): NodeKind {
  const t = node.data?.type as NodeKind | undefined;
  return t && NODE_KINDS.includes(t) ? t : "action";
}

/** Simple flat key paths of a JSON-ish object: { a: { b: 1 } } → ["a", "a.b"]. */
export function objectKeyPaths(value: unknown, prefix = "", depth = 0, out: string[] = []): string[] {
  if (depth > 3 || value === null || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    objectKeyPaths(child, path, depth + 1, out);
  }
  return out;
}
