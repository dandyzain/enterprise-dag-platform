import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeDAGWorkflow, ExecutionJobData } from "@/lib/queue/workflow-executor";
import {
  createWorkflowExecution,
  getWorkflowExecutionById,
  setExecutionDbAvailability,
} from "@/lib/services/execution-service";
import { DAGNode, DAGEdge } from "@/lib/dag/types";

describe("DAG Workflow Execution Engine", () => {
  beforeEach(() => {
    setExecutionDbAvailability(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, processed: true }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should execute a linear DAG successfully in topological order", async () => {
    const exec = await createWorkflowExecution("wf_test_linear", {
      userId: "usr_9981",
      tier: "enterprise",
    });

    const nodes: DAGNode[] = [
      {
        id: "step_trigger",
        data: {
          label: "Customer Trigger",
          type: "trigger",
          config: { payload: { userId: "usr_9981", tier: "enterprise" } },
        },
      },
      {
        id: "step_filter",
        data: {
          label: "Check Enterprise Tier",
          type: "filter",
          config: {
            field: "{{trigger.body.tier}}",
            operator: "equals",
            value: "enterprise",
          },
        },
      },
      {
        id: "step_action",
        data: {
          label: "Provision Account",
          type: "action",
          config: {
            url: "https://httpbin.org/post",
            method: "POST",
            body: {
              account: "{{trigger.body.userId}}",
              tier: "{{trigger.body.tier}}",
            },
          },
        },
      },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "step_trigger", target: "step_filter" },
      { id: "e2", source: "step_filter", target: "step_action" },
    ];

    const jobData: ExecutionJobData = {
      executionId: exec.id,
      workflowId: "wf_test_linear",
      workflowName: "Linear Provisioning Workflow",
      nodes,
      edges,
      triggerPayload: {
        userId: "usr_9981",
        tier: "enterprise",
      },
    };

    const result = await executeDAGWorkflow(jobData);
    expect(result.success).toBe(true);

    const updatedExec = await getWorkflowExecutionById(exec.id);
    expect(updatedExec).not.toBeNull();
    expect(updatedExec?.status).toBe("SUCCESS");
    expect(updatedExec?.steps.length).toBe(3);

    const triggerStep = updatedExec?.steps.find((s) => s.nodeId === "step_trigger");
    const filterStep = updatedExec?.steps.find((s) => s.nodeId === "step_filter");
    const actionStep = updatedExec?.steps.find((s) => s.nodeId === "step_action");

    expect(triggerStep?.status).toBe("SUCCESS");
    expect(filterStep?.status).toBe("SUCCESS");
    expect(actionStep?.status).toBe("SUCCESS");
  });

  it("should skip downstream nodes when a filter condition evaluates to false", async () => {
    const exec = await createWorkflowExecution("wf_test_filter_fail", {
      tier: "free_tier",
    });

    const nodes: DAGNode[] = [
      {
        id: "node_trigger",
        data: {
          label: "Trigger",
          type: "trigger",
          config: {},
        },
      },
      {
        id: "node_filter",
        data: {
          label: "Require Enterprise",
          type: "filter",
          config: {
            field: "{{trigger.body.tier}}",
            operator: "equals",
            value: "enterprise",
          },
        },
      },
      {
        id: "node_downstream_action",
        data: {
          label: "Send VIP Welcome",
          type: "action",
          config: {
            url: "https://httpbin.org/post",
            method: "POST",
          },
        },
      },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "node_trigger", target: "node_filter" },
      { id: "e2", source: "node_filter", target: "node_downstream_action" },
    ];

    const jobData: ExecutionJobData = {
      executionId: exec.id,
      workflowId: "wf_test_filter_fail",
      workflowName: "Filter Gating Workflow",
      nodes,
      edges,
      triggerPayload: {
        tier: "free_tier",
      },
    };

    const result = await executeDAGWorkflow(jobData);
    expect(result.success).toBe(true);

    const updatedExec = await getWorkflowExecutionById(exec.id);
    expect(updatedExec).not.toBeNull();

    const downstreamStep = updatedExec?.steps.find(
      (s) => s.nodeId === "node_downstream_action"
    );
    expect(downstreamStep).toBeDefined();
    expect(downstreamStep?.status).toBe("FAILED");
    expect(downstreamStep?.errorMessage).toContain(
      "Skipped: Upstream conditional filter evaluated to false"
    );
  });

  it("should interpolate variable context across multiple sequential steps", async () => {
    const exec = await createWorkflowExecution("wf_test_interp", {
      orderId: "ord_5521",
    });

    const nodes: DAGNode[] = [
      {
        id: "step_start",
        data: {
          label: "Order Placed",
          type: "trigger",
          config: {},
        },
      },
      {
        id: "step_verify",
        data: {
          label: "Verify Order ID Exists",
          type: "filter",
          config: {
            field: "{{trigger.body.orderId}}",
            operator: "exists",
          },
        },
      },
    ];

    const edges: DAGEdge[] = [
      { id: "e1", source: "step_start", target: "step_verify" },
    ];

    const jobData: ExecutionJobData = {
      executionId: exec.id,
      workflowId: "wf_test_interp",
      workflowName: "Context Interpolation Pipeline",
      nodes,
      edges,
      triggerPayload: {
        orderId: "ord_5521",
      },
    };

    const result = await executeDAGWorkflow(jobData);
    expect(result.success).toBe(true);

    const updatedExec = await getWorkflowExecutionById(exec.id);
    const filterStep = updatedExec?.steps.find((s) => s.nodeId === "step_verify");
    expect(filterStep?.status).toBe("SUCCESS");
  });

  it("should emit real-time telemetry events to executionEventEmitter", async () => {
    const { executionEventEmitter } = await import("@/lib/services/execution-service");

    const exec = await createWorkflowExecution("wf_test_events", {
      event: "realtime_ping",
    });

    const receivedEvents: string[] = [];
    const eventHandler = (payload: { type: string }) => {
      receivedEvents.push(payload.type);
    };

    executionEventEmitter.on(`exec:${exec.id}`, eventHandler);

    const nodes: DAGNode[] = [
      {
        id: "step_trigger_event",
        data: {
          label: "Event Trigger",
          type: "trigger",
          config: {},
        },
      },
    ];

    const edges: DAGEdge[] = [];

    const jobData: ExecutionJobData = {
      executionId: exec.id,
      workflowId: "wf_test_events",
      workflowName: "Telemetry Event Stream Test",
      nodes,
      edges,
      triggerPayload: { event: "realtime_ping" },
    };

    const result = await executeDAGWorkflow(jobData);
    expect(result.success).toBe(true);

    executionEventEmitter.off(`exec:${exec.id}`, eventHandler);

    expect(receivedEvents).toContain("step_recorded");
    expect(receivedEvents).toContain("completed");
  });
});
