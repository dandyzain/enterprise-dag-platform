import { DAGNode, DAGEdge } from "./types";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "customer-enrichment",
    name: "Customer Onboarding & Tier Routing",
    description: "Ingests registration events, queries billing profile, and routes enterprise customers.",
    nodes: [
      {
        id: "node_trigger_1",
        type: "workflowNode",
        position: { x: 300, y: 80 },
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
        position: { x: 300, y: 240 },
        data: {
          label: "Query Billing Service",
          type: "action",
          description: "Queries external JSON REST API with Bearer token",
          config: {
            url: "https://jsonplaceholder.typicode.com/users/1",
            method: "GET",
            headers: {
              Authorization: "{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}",
              Accept: "application/json",
            },
          },
        },
      },
      {
        id: "node_filter_1",
        type: "workflowNode",
        position: { x: 300, y: 400 },
        data: {
          label: "Enterprise Tier Gate",
          type: "filter",
          description: "Only continues if tier equals enterprise",
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
        id: "edge_1",
        source: "node_trigger_1",
        target: "node_action_1",
        type: "workflowEdge",
      },
      {
        id: "edge_2",
        source: "node_action_1",
        target: "node_filter_1",
        type: "workflowEdge",
      },
    ],
  },
  {
    id: "stripe-webhook-ledger",
    name: "Stripe Webhook Event & Auto-Ledger",
    description: "Ingests inbound charge events, verifies payment state, and dispatches accounting sync.",
    nodes: [
      {
        id: "node_webhook_1",
        type: "workflowNode",
        position: { x: 300, y: 80 },
        data: {
          label: "Inbound Stripe Hook",
          type: "webhook",
          description: "Listens for POST events from payment provider",
          config: {
            path: "stripe-charge-events",
            secretHeader: "X-Stripe-Signature",
          },
        },
      },
      {
        id: "node_filter_payment",
        type: "workflowNode",
        position: { x: 300, y: 240 },
        data: {
          label: "Verify Paid Status",
          type: "filter",
          description: "Validates event payload contains status equals paid",
          config: {
            field: "{{trigger.body.status}}",
            operator: "equals",
            value: "paid",
          },
        },
      },
      {
        id: "node_action_slack",
        type: "workflowNode",
        position: { x: 160, y: 400 },
        data: {
          label: "Notify Slack Finance",
          type: "action",
          description: "Dispatches payment notification to internal channel",
          config: {
            url: "https://jsonplaceholder.typicode.com/posts",
            method: "POST",
            body: {
              channel: "#finance-alerts",
              message: "Payment received for {{trigger.body.customerId}}",
            },
          },
        },
      },
      {
        id: "node_action_ledger",
        type: "workflowNode",
        position: { x: 440, y: 400 },
        data: {
          label: "Update Ledger DB",
          type: "action",
          description: "Syncs transaction record into accounting system",
          config: {
            url: "https://jsonplaceholder.typicode.com/posts",
            method: "POST",
            body: {
              account: "revenue_enterprise",
              amount: 499.0,
            },
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_wh_to_filter",
        source: "node_webhook_1",
        target: "node_filter_payment",
        type: "workflowEdge",
      },
      {
        id: "edge_filter_to_slack",
        source: "node_filter_payment",
        target: "node_action_slack",
        type: "workflowEdge",
      },
      {
        id: "edge_filter_to_ledger",
        source: "node_filter_payment",
        target: "node_action_ledger",
        type: "workflowEdge",
      },
    ],
  },
];
