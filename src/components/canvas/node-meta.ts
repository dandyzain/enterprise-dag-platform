import { CalendarClock, GitBranch, Hourglass, Play, Send, Shuffle, Webhook } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/dag/types";

/** Presentation metadata per node type (icons, token colours, i18n keys). */
export const NODE_META: Record<
  WorkflowNodeType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    group: "triggers" | "actions" | "logic";
    badge: WorkflowNodeType;
  }
> = {
  trigger: { icon: Play, color: "var(--node-trigger)", group: "triggers", badge: "trigger" },
  webhook: { icon: Webhook, color: "var(--node-webhook)", group: "triggers", badge: "webhook" },
  schedule: { icon: CalendarClock, color: "var(--node-schedule)", group: "triggers", badge: "schedule" },
  action: { icon: Send, color: "var(--node-action)", group: "actions", badge: "action" },
  transform: { icon: Shuffle, color: "var(--node-transform)", group: "actions", badge: "transform" },
  delay: { icon: Hourglass, color: "var(--node-delay)", group: "logic", badge: "delay" },
  filter: { icon: GitBranch, color: "var(--node-filter)", group: "logic", badge: "filter" },
};

export const NODE_TYPES: WorkflowNodeType[] = ["trigger", "webhook", "schedule", "action", "transform", "filter", "delay"];

/** Step types that can follow another step (everything except triggers). */
export const STEP_NODE_TYPES: WorkflowNodeType[] = ["action", "transform", "filter", "delay"];

/** Default configuration for new nodes. */
export function defaultConfig(type: WorkflowNodeType, newId: string): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { payload: { timestamp: Date.now() } };
    case "webhook":
      return { path: `wh-${newId}`, secretHeader: "", signatureProvider: "none", signingSecretCredential: "" };
    case "schedule":
      return { cron: "0 9 * * 1-5", payload: {} };
    case "action":
      return {
        url: "https://api.example.com/v1/resource",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { eventId: "{{trigger.body.id}}" },
      };
    case "transform":
      return { template: { customerId: "{{trigger.body.customerId}}", receivedAt: "{{trigger.timestamp}}" } };
    case "delay":
      return { durationMs: 5000 };
    case "filter":
      return { field: "{{trigger.body.tier}}", operator: "equals", value: "enterprise" };
    default:
      return {};
  }
}

const KNOWN: WorkflowNodeType[] = ["trigger", "webhook", "schedule", "action", "transform", "delay", "filter"];

export function asNodeType(value: unknown): WorkflowNodeType {
  return KNOWN.includes(value as WorkflowNodeType) ? (value as WorkflowNodeType) : "action";
}
