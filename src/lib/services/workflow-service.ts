import { prisma } from "@/lib/prisma";
import type { DAGNode, DAGEdge } from "@/lib/dag/types";
import { validateDAG } from "@/lib/dag/cycle-detection";
import { tryDb, isDbAvailable, forceDbOffline } from "@/lib/db/circuit";
import { DEMO_ACCOUNTS, DEMO_WORKSPACE } from "@/lib/auth/demo";
import { isDemoMode } from "@/lib/config/env";
import { newId } from "@/lib/store/memory-store";
import { logger } from "@/lib/logger";

export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "DISABLED";

export interface WorkflowRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  nodes: DAGNode[];
  edges: DAGEdge[];
  webhookPath?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const WEBHOOK_PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;
export const MAX_NODES_PER_WORKFLOW = 200;

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------

const globalForWorkflows = globalThis as unknown as { __nfWorkflows?: Map<string, WorkflowRecord> };
const memoryWorkflows: Map<string, WorkflowRecord> =
  globalForWorkflows.__nfWorkflows ?? (globalForWorkflows.__nfWorkflows = new Map());

export function buildDefaultDemoWorkflow(): WorkflowRecord {
  return {
    id: "wf-enterprise-1",
    userId: DEMO_ACCOUNTS["admin@enterprise.io"].id,
    workspaceId: DEMO_WORKSPACE.id,
    name: "Enterprise Customer Ingestion & Enrichment Pipeline",
    description: "Trigger -> HTTP Billing Lookup -> Enterprise Tier Filter",
    status: "PUBLISHED",
    nodes: [
      {
        id: "node_trigger_1",
        type: "workflowNode",
        position: { x: 300, y: 100 },
        data: {
          label: "Customer Registered Trigger",
          type: "trigger",
          description: "Captures new customer sign-up events",
          config: { payload: { customerId: "cust_9824", email: "jane.doe@enterprise.io", tier: "enterprise" } },
        },
      },
      {
        id: "node_action_1",
        type: "workflowNode",
        position: { x: 300, y: 260 },
        data: {
          label: "Fetch Billing Profile",
          type: "action",
          description: "Queries internal billing ledger service",
          config: {
            url: "https://jsonplaceholder.typicode.com/users/1",
            method: "GET",
            headers: { Authorization: "{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}", Accept: "application/json" },
          },
        },
      },
      {
        id: "node_filter_1",
        type: "workflowNode",
        position: { x: 300, y: 420 },
        data: {
          label: "Validate Enterprise Tier",
          type: "filter",
          description: "Routes workflow if customer tier is enterprise",
          config: { field: "{{trigger.body.tier}}", operator: "equals", value: "enterprise" },
        },
      },
    ],
    edges: [
      { id: "edge_trigger_to_action", source: "node_trigger_1", target: "node_action_1", type: "workflowEdge" },
      { id: "edge_action_to_filter", source: "node_action_1", target: "node_filter_1", type: "workflowEdge" },
    ],
    webhookPath: "customer-signup-hook",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

if (isDemoMode() && !memoryWorkflows.has("wf-enterprise-1")) {
  const wf = buildDefaultDemoWorkflow();
  memoryWorkflows.set(wf.id, wf);
}

/** @deprecated kept for tests: forces the in-memory store for every service. */
export function setWorkflowDbAvailability(available: boolean): void {
  forceDbOffline(!available);
}

export function isWorkflowDbAvailableState(): boolean {
  return isDbAvailable();
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

type DbWorkflow = {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  status: string;
  nodes: unknown;
  edges: unknown;
  webhookPath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function fromDb(r: DbWorkflow): WorkflowRecord {
  return {
    id: r.id,
    userId: r.userId,
    workspaceId: r.workspaceId,
    name: r.name,
    description: r.description,
    status: r.status as WorkflowStatus,
    nodes: (r.nodes as DAGNode[]) ?? [],
    edges: (r.edges as DAGEdge[]) ?? [],
    webhookPath: r.webhookPath,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Demo seeding in PostgreSQL (once per process, demo workspace only)
// ---------------------------------------------------------------------------

let demoSeedAttempted = false;

async function ensureDemoWorkflowInDb(workspaceId: string): Promise<void> {
  if (demoSeedAttempted || workspaceId !== DEMO_WORKSPACE.id || !isDemoMode()) return;
  demoSeedAttempted = true;
  try {
    const count = await prisma.workflow.count({ where: { workspaceId } });
    if (count > 0) return;
    const { ensurePrincipalInDb, DEMO_USERS } = await import("@/lib/services/auth-service");
    const ownerId = await ensurePrincipalInDb(DEMO_USERS["admin@enterprise.io"].session);
    const wf = buildDefaultDemoWorkflow();
    const pathTaken = await prisma.workflow.findUnique({ where: { webhookPath: wf.webhookPath! } });
    await prisma.workflow.upsert({
      where: { id: wf.id },
      create: {
        id: wf.id,
        userId: ownerId,
        workspaceId,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        nodes: wf.nodes as unknown as object,
        edges: wf.edges as unknown as object,
        webhookPath: pathTaken ? null : wf.webhookPath,
      },
      update: {},
    });
  } catch (err) {
    logger.warn("Could not seed the demo workflow into PostgreSQL", { err });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Unscoped lookup — only for trusted server code (webhooks, workers). */
export async function getWorkflowById(id: string): Promise<WorkflowRecord | null> {
  const res = await tryDb(() => prisma.workflow.findUnique({ where: { id } }));
  if (res.ok) return res.value ? fromDb(res.value) : null;
  return memoryWorkflows.get(id) ?? null;
}

/** Tenant-scoped lookup: returns null for workflows of other workspaces. */
export async function getWorkflowForWorkspace(id: string, workspaceId: string): Promise<WorkflowRecord | null> {
  const wf = await getWorkflowById(id);
  if (!wf || wf.workspaceId !== workspaceId) return null;
  return wf;
}

export async function getWorkflowByWebhookPath(path: string): Promise<WorkflowRecord | null> {
  const res = await tryDb(() => prisma.workflow.findUnique({ where: { webhookPath: path } }));
  if (res.ok) {
    if (res.value) return fromDb(res.value);
    // The demo workflow is copied into PostgreSQL lazily; make sure it exists before giving up.
    if (!isDemoMode() || demoSeedAttempted) return null;
    await ensureDemoWorkflowInDb(DEMO_WORKSPACE.id);
    const retry = await tryDb(() => prisma.workflow.findUnique({ where: { webhookPath: path } }));
    return retry.ok && retry.value ? fromDb(retry.value) : null;
  }
  for (const wf of memoryWorkflows.values()) {
    if (wf.webhookPath === path) return wf;
  }
  return null;
}

export async function listWorkflows(workspaceId: string): Promise<WorkflowRecord[]> {
  if (isDbAvailable()) await ensureDemoWorkflowInDb(workspaceId);
  const res = await tryDb(() => prisma.workflow.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } }));
  if (res.ok) return res.value.map(fromDb);

  return Array.from(memoryWorkflows.values())
    .filter((wf) => wf.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function countWorkflows(workspaceId: string): Promise<number> {
  const res = await tryDb(() => prisma.workflow.count({ where: { workspaceId } }));
  if (res.ok) return res.value;
  return Array.from(memoryWorkflows.values()).filter((wf) => wf.workspaceId === workspaceId).length;
}

/** All published workflows that contain a schedule trigger (for the cron scheduler). */
export async function listScheduledWorkflows(): Promise<WorkflowRecord[]> {
  const hasSchedule = (wf: WorkflowRecord) => wf.nodes.some((n) => n.data?.type === "schedule");
  const res = await tryDb(() => prisma.workflow.findMany({ where: { status: "PUBLISHED" } }));
  if (res.ok) return res.value.map(fromDb).filter(hasSchedule);
  return Array.from(memoryWorkflows.values()).filter((wf) => wf.status === "PUBLISHED" && hasSchedule(wf));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface SaveWorkflowInput {
  id: string;
  name: string;
  description?: string | null;
  status?: WorkflowStatus;
  nodes: DAGNode[];
  edges: DAGEdge[];
  webhookPath?: string | null;
  /** Creator / last editor (database user id). */
  userId?: string;
  workspaceId?: string | null;
}

export interface SaveWorkflowResult {
  success: boolean;
  workflow?: WorkflowRecord;
  error?: string;
  cycleNodes?: string[];
}

function extractWebhookPath(id: string, nodes: DAGNode[]): { path: string | null; error?: string } {
  const webhookNode = nodes.find((n) => n.data?.type === "webhook");
  if (!webhookNode) return { path: null };
  const cfgPath = webhookNode.data.config?.path;
  const path = typeof cfgPath === "string" && cfgPath.trim().length > 0 ? cfgPath.trim().replace(/^\/+/, "") : `wh-${id}`;
  if (!WEBHOOK_PATH_PATTERN.test(path)) {
    return { path: null, error: "Webhook path may only contain letters, numbers, '-' and '_' (3–80 characters)." };
  }
  return { path };
}

export async function saveWorkflow(input: SaveWorkflowInput): Promise<SaveWorkflowResult> {
  const name = input.name?.trim() || "Untitled workflow";
  if (name.length > 120) return { success: false, error: "Workflow name must be at most 120 characters." };
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return { success: false, error: "Invalid graph." };
  if (input.nodes.length > MAX_NODES_PER_WORKFLOW) {
    return { success: false, error: `A workflow can contain at most ${MAX_NODES_PER_WORKFLOW} steps.` };
  }

  // 1. Strict DAG cycle validation
  const validation = validateDAG(input.nodes, input.edges);
  if (validation.hasCycle) {
    return {
      success: false,
      error: `Cycle detected in graph: ${validation.cycleNodes?.join(" → ")}`,
      cycleNodes: validation.cycleNodes,
    };
  }

  const webhook = extractWebhookPath(input.id, input.nodes);
  if (webhook.error) return { success: false, error: webhook.error };

  const workspaceId = input.workspaceId ?? null;
  const existing = await getWorkflowById(input.id);
  if (existing && existing.workspaceId !== workspaceId) {
    // Never let one tenant overwrite another tenant's workflow by guessing its id.
    return { success: false, error: "Workflow not found." };
  }

  if (webhook.path) {
    const owner = await getWorkflowByWebhookPath(webhook.path);
    if (owner && owner.id !== input.id) {
      return { success: false, error: `Webhook path '${webhook.path}' is already used by another workflow.` };
    }
  }

  const record: WorkflowRecord = {
    id: input.id,
    userId: existing?.userId ?? input.userId ?? "system",
    workspaceId,
    name,
    description: input.description ?? existing?.description ?? null,
    status: input.status ?? existing?.status ?? "DRAFT",
    nodes: input.nodes,
    edges: input.edges,
    webhookPath: webhook.path,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };

  const res = await tryDb(() =>
    prisma.workflow.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        userId: record.userId,
        workspaceId: record.workspaceId,
        name: record.name,
        description: record.description,
        status: record.status,
        nodes: record.nodes as unknown as object,
        edges: record.edges as unknown as object,
        webhookPath: record.webhookPath,
      },
      update: {
        name: record.name,
        description: record.description,
        status: record.status,
        nodes: record.nodes as unknown as object,
        edges: record.edges as unknown as object,
        webhookPath: record.webhookPath,
      },
    })
  );

  if (res.ok) return { success: true, workflow: fromDb(res.value) };

  memoryWorkflows.set(record.id, record);
  return { success: true, workflow: record };
}

export async function setWorkflowStatus(
  id: string,
  workspaceId: string,
  status: WorkflowStatus
): Promise<{ success: boolean; error?: string }> {
  const wf = await getWorkflowForWorkspace(id, workspaceId);
  if (!wf) return { success: false, error: "Workflow not found." };
  if (status === "PUBLISHED") {
    const validation = validateDAG(wf.nodes, wf.edges);
    if (validation.hasCycle) {
      return { success: false, error: `Cannot publish: DAG contains cycle (${validation.cycleNodes?.join(" → ")})` };
    }
    if (wf.nodes.length === 0) return { success: false, error: "Cannot publish an empty workflow." };
  }

  const res = await tryDb(() => prisma.workflow.update({ where: { id }, data: { status } }));
  if (!res.ok) {
    const mem = memoryWorkflows.get(id);
    if (mem) {
      mem.status = status;
      mem.updatedAt = new Date();
    }
  }
  return { success: true };
}

export async function deleteWorkflow(id: string, workspaceId: string): Promise<{ success: boolean; error?: string }> {
  const wf = await getWorkflowForWorkspace(id, workspaceId);
  if (!wf) return { success: false, error: "Workflow not found." };
  const res = await tryDb(() => prisma.workflow.delete({ where: { id } }));
  if (!res.ok) memoryWorkflows.delete(id);
  return { success: true };
}

export async function duplicateWorkflow(
  id: string,
  workspaceId: string,
  userId: string
): Promise<SaveWorkflowResult> {
  const wf = await getWorkflowForWorkspace(id, workspaceId);
  if (!wf) return { success: false, error: "Workflow not found." };

  const newWorkflowId = newId("wf");
  const nodes: DAGNode[] = wf.nodes.map((n) =>
    n.data?.type === "webhook"
      ? { ...n, data: { ...n.data, config: { ...n.data.config, path: `wh-${newWorkflowId}` } } }
      : n
  );

  return saveWorkflow({
    id: newWorkflowId,
    name: `${wf.name} (copy)`.slice(0, 120),
    description: wf.description,
    status: "DRAFT",
    nodes,
    edges: wf.edges,
    userId,
    workspaceId,
  });
}
