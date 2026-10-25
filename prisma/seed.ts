import { PrismaClient } from "@prisma/client";
import { encryptData } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting enterprise DAG database seeding...");

  // 1. Seed Default Principal Architect User
  const user = await prisma.user.upsert({
    where: { email: "admin@enterprise-dag.io" },
    update: {
      name: "Principal Architect",
    },
    create: {
      id: "usr_principal_architect_01",
      email: "admin@enterprise-dag.io",
      name: "Principal Architect",
    },
  });
  console.log(`✓ User provisioned: ${user.name} (${user.email})`);

  // 2. Seed Production Hardware-Vault Encrypted Credentials
  const credentialsToSeed = [
    {
      id: "cred_stripe_live_prod",
      userId: user.id,
      name: "STRIPE_PRODUCTION_API_KEY",
      type: "bearer_token",
      plainSecret: "mock_stripe_live_corp_vault_token_sample",
    },
    {
      id: "cred_openai_org",
      userId: user.id,
      name: "OPENAI_ORGANIZATION_KEY",
      type: "api_key",
      plainSecret: "mock_openai_vault_api_key_sample",
    },
    {
      id: "cred_ledger_hmac",
      userId: user.id,
      name: "INTERNAL_LEDGER_AUTH_SECRET",
      type: "hmac_secret",
      plainSecret: "Bearer token_corp_secret_authenticated_ledger_2026",
    },
  ];

  for (const cred of credentialsToSeed) {
    const enc = encryptData(cred.plainSecret);
    await prisma.credential.upsert({
      where: { id: cred.id },
      update: {
        name: cred.name,
        type: cred.type,
        encryptedData: enc.encryptedData,
        iv: enc.iv,
      },
      create: {
        id: cred.id,
        userId: cred.userId,
        name: cred.name,
        type: cred.type,
        encryptedData: enc.encryptedData,
        iv: enc.iv,
      },
    });
    console.log(`✓ Encrypted Vault Credential: ${cred.name} [AES-256-GCM]`);
  }

  // 3. Seed Production Workflows
  const customerEnrichmentNodes = [
    {
      id: "node_trigger_signup",
      type: "workflowNode",
      position: { x: 300, y: 100 },
      data: {
        label: "Customer Ingestion Trigger",
        type: "trigger",
        description: "Captures new enterprise signup events",
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
      id: "node_action_billing",
      type: "workflowNode",
      position: { x: 300, y: 260 },
      data: {
        label: "Query Billing Service",
        type: "action",
        description: "Fetches subscription details from internal ledger",
        config: {
          url: "https://api.internal.corp/billing/{{trigger.body.customerId}}",
          method: "GET",
          headers: {
            Authorization: "{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}",
          },
        },
      },
    },
    {
      id: "node_filter_tier",
      type: "workflowNode",
      position: { x: 300, y: 420 },
      data: {
        label: "Validate Enterprise Tier",
        type: "filter",
        description: "Ensures subscription tier is enterprise",
        config: {
          field: "{{trigger.body.tier}}",
          operator: "equals",
          value: "enterprise",
        },
      },
    },
    {
      id: "node_action_stripe",
      type: "workflowNode",
      position: { x: 300, y: 580 },
      data: {
        label: "Provision Stripe Customer",
        type: "action",
        description: "Creates production customer profile in Stripe",
        config: {
          url: "https://api.stripe.com/v1/customers",
          method: "POST",
          headers: {
            Authorization: "{{credentials.STRIPE_PRODUCTION_API_KEY}}",
          },
          body: {
            email: "{{trigger.body.email}}",
            metadata: {
              customerId: "{{trigger.body.customerId}}",
            },
          },
        },
      },
    },
  ];

  const customerEnrichmentEdges = [
    {
      id: "edge_trigger_to_billing",
      source: "node_trigger_signup",
      target: "node_action_billing",
      type: "workflowEdge",
    },
    {
      id: "edge_billing_to_filter",
      source: "node_action_billing",
      target: "node_filter_tier",
      type: "workflowEdge",
    },
    {
      id: "edge_filter_to_stripe",
      source: "node_filter_tier",
      target: "node_action_stripe",
      type: "workflowEdge",
    },
  ];

  const wf1 = await prisma.workflow.upsert({
    where: { id: "wf_customer_enrichment" },
    update: {
      name: "Customer Enrichment & Billing Pipeline",
      description: "Automated DAG pipeline orchestrating signup ingestion, KYC verification, and Stripe ledger syncing.",
      status: "PUBLISHED",
      nodes: customerEnrichmentNodes,
      edges: customerEnrichmentEdges,
    },
    create: {
      id: "wf_customer_enrichment",
      userId: user.id,
      name: "Customer Enrichment & Billing Pipeline",
      description: "Automated DAG pipeline orchestrating signup ingestion, KYC verification, and Stripe ledger syncing.",
      status: "PUBLISHED",
      nodes: customerEnrichmentNodes,
      edges: customerEnrichmentEdges,
    },
  });
  console.log(`✓ Workflow created: ${wf1.name} [ID: ${wf1.id}]`);

  const stripeWebhookNodes = [
    {
      id: "node_wh_stripe",
      type: "workflowNode",
      position: { x: 280, y: 120 },
      data: {
        label: "Stripe Webhook Listener",
        type: "webhook",
        description: "Captures charge.succeeded webhook events",
        config: {
          path: "stripe-charge-hook",
          secretHeader: "whsec_stripe_corp_ledger_key",
        },
      },
    },
    {
      id: "node_filter_fraud",
      type: "workflowNode",
      position: { x: 280, y: 280 },
      data: {
        label: "Fraud Risk Threshold",
        type: "filter",
        description: "Filters out high-risk transactions",
        config: {
          field: "{{trigger.body.riskLevel}}",
          operator: "notEquals",
          value: "high",
        },
      },
    },
    {
      id: "node_action_ledger",
      type: "workflowNode",
      position: { x: 280, y: 440 },
      data: {
        label: "Commit to Immutable Ledger",
        type: "action",
        description: "Records verified transaction to enterprise SQL database",
        config: {
          url: "https://ledger.internal.corp/api/v2/transactions",
          method: "POST",
          headers: {
            Authorization: "{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}",
          },
          body: {
            chargeId: "{{trigger.body.id}}",
            amount: "{{trigger.body.amount}}",
            status: "COMMITTED",
          },
        },
      },
    },
  ];

  const stripeWebhookEdges = [
    {
      id: "edge_wh_to_filter",
      source: "node_wh_stripe",
      target: "node_filter_fraud",
      type: "workflowEdge",
    },
    {
      id: "edge_filter_to_ledger",
      source: "node_filter_fraud",
      target: "node_action_ledger",
      type: "workflowEdge",
    },
  ];

  const wf2 = await prisma.workflow.upsert({
    where: { id: "wf_stripe_ledger" },
    update: {
      name: "Stripe Payment Ledger & Fraud Filter",
      description: "Distributed webhook ingestion validating risk score and committing transactions to ledger.",
      status: "PUBLISHED",
      webhookPath: "stripe-charge-hook",
      nodes: stripeWebhookNodes,
      edges: stripeWebhookEdges,
    },
    create: {
      id: "wf_stripe_ledger",
      userId: user.id,
      name: "Stripe Payment Ledger & Fraud Filter",
      description: "Distributed webhook ingestion validating risk score and committing transactions to ledger.",
      status: "PUBLISHED",
      webhookPath: "stripe-charge-hook",
      nodes: stripeWebhookNodes,
      edges: stripeWebhookEdges,
    },
  });
  console.log(`✓ Workflow created: ${wf2.name} [Webhook: /api/workflows/wh/${wf2.webhookPath}]`);

  // 4. Seed Audit Execution History
  const exec1 = await prisma.workflowExecution.upsert({
    where: { id: "exec_seed_001" },
    update: {},
    create: {
      id: "exec_seed_001",
      workflowId: wf1.id,
      status: "SUCCESS",
      triggerData: {
        customerId: "cust_enterprise_001",
        email: "alex@globalcorp.com",
        tier: "enterprise",
      },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3598500),
      durationMs: 1500,
    },
  });

  const steps1 = [
    {
      id: "step_exec_001_1",
      workflowExecutionId: exec1.id,
      nodeId: "node_trigger_signup",
      nodeType: "trigger",
      status: "SUCCESS",
      inputData: { customerId: "cust_enterprise_001" },
      outputData: { success: true },
      durationMs: 12,
    },
    {
      id: "step_exec_001_2",
      workflowExecutionId: exec1.id,
      nodeId: "node_action_billing",
      nodeType: "action",
      status: "SUCCESS",
      inputData: { url: "https://api.internal.corp/billing/cust_enterprise_001" },
      outputData: { status: 200, tier: "enterprise", credits: 50000 },
      durationMs: 420,
    },
    {
      id: "step_exec_001_3",
      workflowExecutionId: exec1.id,
      nodeId: "node_filter_tier",
      nodeType: "filter",
      status: "SUCCESS",
      inputData: { field: "enterprise", operator: "equals", value: "enterprise" },
      outputData: { matched: true },
      durationMs: 2,
    },
    {
      id: "step_exec_001_4",
      workflowExecutionId: exec1.id,
      nodeId: "node_action_stripe",
      nodeType: "action",
      status: "SUCCESS",
      inputData: { customerEmail: "alex@globalcorp.com" },
      outputData: { stripeCustomerId: "cus_LiveProd9921", status: "active" },
      durationMs: 650,
    },
  ];

  for (const step of steps1) {
    await prisma.stepExecution.upsert({
      where: { id: step.id },
      update: {},
      create: {
        id: step.id,
        workflowExecutionId: step.workflowExecutionId,
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        status: "SUCCESS",
        inputData: step.inputData,
        outputData: step.outputData,
        durationMs: step.durationMs,
      },
    });
  }
  console.log(`✓ Telemetry execution seeded: ${exec1.id} with ${steps1.length} step audit records`);

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
