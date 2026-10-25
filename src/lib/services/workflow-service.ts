import { prisma } from "@/lib/prisma";
import { DAGNode, DAGEdge, WorkflowNodeType } from "@/lib/dag/types";
import { validateDAG } from "@/lib/dag/cycle-detection";

export interface WorkflowRecord {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  nodes: DAGNode[];
  edges: DAGEdge[];
  webhookPath?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Memory-backed storage store for seamless operation if DB connection is offline
const memoryWorkflows = new Map<string, WorkflowRecord>();

// Pre-populate with default enterprise workflow
const defaultWorkflow: WorkflowRecord = {
  id: "wf-enterprise-1",
  userId: "usr_default_admin",
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
        config: {
          payload: {
            customerId: "cust_9824",
            email: "jane.doe@enterprise.io",
            tier: "enterprise",
          },
        },
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
          headers: {
            Authorization: "Bearer token_corp_secret",
            Accept: "application/json",
          },
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
        config: {
          field: "{{trigger.body.tier}}",
          operator: "equals",
          value: "enterprise",
        },
      },
    },
  ],
  edges: [
    {
      id: "edge_trigger_to_action",
      source: "node_trigger_1",
      target: "node_action_1",
      type: "workflowEdge",
    },
    {
      id: "edge_action_to_filter",
      source: "node_action_1",
      target: "node_filter_1",
      type: "workflowEdge",
    },
  ],
  webhookPath: "customer-signup-hook",
  createdAt: new Date(),
  updatedAt: new Date(),
};

memoryWorkflows.set(defaultWorkflow.id, defaultWorkflow);
if (defaultWorkflow.webhookPath) {
  memoryWorkflows.set(`wh:${defaultWorkflow.webhookPath}`, defaultWorkflow);
}

let isWorkflowDbAvailable = true;

export function setWorkflowDbAvailability(available: boolean): void {
  isWorkflowDbAvailable = available;
}

export function isWorkflowDbAvailableState(): boolean {
  return isWorkflowDbAvailable;
}

export async function getWorkflowById(id: string): Promise<WorkflowRecord | null> {
  if (isWorkflowDbAvailable) {
    try {
      const dbRecord = await prisma.workflow.findUnique({
        where: { id },
      });
      if (dbRecord) {
        return {
          id: dbRecord.id,
          userId: dbRecord.userId,
          name: dbRecord.name,
          description: dbRecord.description,
          status: dbRecord.status as "DRAFT" | "PUBLISHED" | "DISABLED",
          nodes: dbRecord.nodes as unknown as DAGNode[],
          edges: dbRecord.edges as unknown as DAGEdge[],
          webhookPath: dbRecord.webhookPath,
          createdAt: dbRecord.createdAt,
          updatedAt: dbRecord.updatedAt,
        };
      }
    } catch {
      isWorkflowDbAvailable = false;
    }
  }

  return memoryWorkflows.get(id) || null;
}

export async function getWorkflowByWebhookPath(path: string): Promise<WorkflowRecord | null> {
  if (isWorkflowDbAvailable) {
    try {
      const dbRecord = await prisma.workflow.findUnique({
        where: { webhookPath: path },
      });
      if (dbRecord) {
        return {
          id: dbRecord.id,
          userId: dbRecord.userId,
          name: dbRecord.name,
          description: dbRecord.description,
          status: dbRecord.status as "DRAFT" | "PUBLISHED" | "DISABLED",
          nodes: dbRecord.nodes as unknown as DAGNode[],
          edges: dbRecord.edges as unknown as DAGEdge[],
          webhookPath: dbRecord.webhookPath,
          createdAt: dbRecord.createdAt,
          updatedAt: dbRecord.updatedAt,
        };
      }
    } catch {
      isWorkflowDbAvailable = false;
    }
  }

  const byWh = memoryWorkflows.get(`wh:${path}`);
  if (byWh) return byWh;

  for (const wf of memoryWorkflows.values()) {
    if (wf.webhookPath === path) return wf;
  }
  return null;
}

export interface SaveWorkflowInput {
  id: string;
  name: string;
  description?: string | null;
  status?: "DRAFT" | "PUBLISHED" | "DISABLED";
  nodes: DAGNode[];
  edges: DAGEdge[];
  webhookPath?: string | null;
  userId?: string;
}

export async function saveWorkflow(input: SaveWorkflowInput): Promise<{
  success: boolean;
  workflow?: WorkflowRecord;
  error?: string;
  cycleNodes?: string[];
}> {
  // 1. Strict DAG Cycle Validation
  const validation = validateDAG(input.nodes, input.edges);
  if (validation.hasCycle) {
    return {
      success: false,
      error: `Cycle detected in graph: ${validation.cycleNodes?.join(" → ")}`,
      cycleNodes: validation.cycleNodes,
    };
  }

  // 2. Extract Webhook Path if Webhook node exists
  let webhookPath: string | null = null;
  const webhookNode = input.nodes.find((n) => n.data.type === "webhook");
  if (webhookNode) {
    const cfgPath = webhookNode.data.config.path;
    if (typeof cfgPath === "string" && cfgPath.trim().length > 0) {
      webhookPath = cfgPath.trim().replace(/^\/+/, "");
    } else {
      webhookPath = `wh-${input.id}`;
    }
  }

  const record: WorkflowRecord = {
    id: input.id,
    userId: input.userId || "usr_default_admin",
    name: input.name,
    description: input.description || null,
    status: input.status || "DRAFT",
    nodes: input.nodes,
    edges: input.edges,
    webhookPath,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 3. Save to Prisma if available
  if (isWorkflowDbAvailable) {
    try {
      // Ensure default user exists
      await prisma.user.upsert({
        where: { id: record.userId },
        create: {
          id: record.userId,
          email: "admin@enterprise.io",
          name: "Enterprise Architect",
        },
        update: {},
      });

      const saved = await prisma.workflow.upsert({
        where: { id: input.id },
        create: {
          id: record.id,
          userId: record.userId,
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
      });

      record.updatedAt = saved.updatedAt;
    } catch {
      isWorkflowDbAvailable = false;
    }
  }

  // Update memory cache
  memoryWorkflows.set(record.id, record);
  if (record.webhookPath) {
    memoryWorkflows.set(`wh:${record.webhookPath}`, record);
  }

  return {
    success: true,
    workflow: record,
  };
}

export async function listWorkflows(): Promise<WorkflowRecord[]> {
  if (isWorkflowDbAvailable) {
    try {
      const records = await prisma.workflow.findMany({
        orderBy: { updatedAt: "desc" },
      });
      if (records.length > 0) {
        return records.map((r) => ({
          id: r.id,
          userId: r.userId,
          name: r.name,
          description: r.description,
          status: r.status as "DRAFT" | "PUBLISHED" | "DISABLED",
          nodes: r.nodes as unknown as DAGNode[],
          edges: r.edges as unknown as DAGEdge[],
          webhookPath: r.webhookPath,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      }
    } catch {
      isWorkflowDbAvailable = false;
    }
  }

  const unique = new Map<string, WorkflowRecord>();
  for (const [key, val] of memoryWorkflows.entries()) {
    if (!key.startsWith("wh:")) {
      unique.set(val.id, val);
    }
  }
  return Array.from(unique.values());
}
