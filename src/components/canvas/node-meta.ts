import { GitBranch, Play, Send, Webhook } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/dag/types";

/** Presentation metadata per node type (icons, token colours, i18n keys). */
export const NODE_META: Record<
  WorkflowNodeType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    group: "triggers" | "actions" | "logic";
    badge: "trigger" | "webhook" | "action" | "filter";
  }
> = {
  trigger: { icon: Play, color: "var(--node-trigger)", group: "triggers", badge: "trigger" },
  webhook: { icon: Webhook, color: "var(--node-webhook)", group: "triggers", badge: "webhook" },
  action: { icon: Send, color: "var(--node-action)", group: "actions", badge: "action" },
  filter: { icon: GitBranch, color: "var(--node-filter)", group: "logic", badge: "filter" },
};

export const NODE_TYPES: WorkflowNodeType[] = ["trigger", "webhook", "action", "filter"];

/** Default configuration for new nodes — identical to the previous editor. */
export function defaultConfig(type: WorkflowNodeType, newId: string): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { payload: { timestamp: Date.now() } };
    case "webhook":
      return { path: `wh-${newId}`, secretHeader: "" };
    case "action":
      return {
        url: "https://api.example.com/v1/resource",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { eventId: "{{trigger.body.id}}" },
      };
    case "filter":
      return { field: "{{trigger.body.tier}}", operator: "equals", value: "enterprise" };
  }
}

export function asNodeType(value: unknown): WorkflowNodeType {
  return value === "trigger" || value === "webhook" || value === "filter" ? value : "action";
}
