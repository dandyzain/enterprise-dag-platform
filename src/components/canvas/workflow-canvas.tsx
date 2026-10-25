"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowInstance,
  ReactFlowProvider,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CustomWorkflowNode } from "./custom-node";
import { CustomWorkflowEdge } from "./custom-edge";
import { NodePalette } from "./node-palette";
import { NodeInspector } from "./node-inspector";
import { WorkflowNavbar } from "./workflow-navbar";
import { MobileWarningBanner } from "./mobile-warning";
import { DAGNode, DAGEdge, NodeData, WorkflowNodeType } from "@/lib/dag/types";
import { validateDAG } from "@/lib/dag/cycle-detection";
import { getTopologicalOrder } from "@/lib/dag/topological-sort";
import { interpolateVariables, ExecutionContext } from "@/lib/dag/variable-interpolator";
import { autoLayoutDAG } from "@/lib/dag/auto-layout";
import { WORKFLOW_TEMPLATES } from "@/lib/dag/templates";
import {
  saveWorkflowAction,
  publishWorkflowAction,
  triggerWorkflowExecutionAction,
} from "@/lib/actions/workflow-actions";
import { ExecutionHistoryModal } from "./execution-history-modal";
import { WebhookConsoleModal } from "./webhook-console-modal";
import { WorkflowExecutionRecord } from "@/lib/services/execution-service";
import { SessionUser } from "@/lib/services/auth-service";

interface WorkflowCanvasProps {
  workflowId: string;
  initialName: string;
  initialStatus: "DRAFT" | "PUBLISHED" | "DISABLED";
  initialNodes?: DAGNode[];
  initialEdges?: DAGEdge[];
  session?: SessionUser | null;
}

const DEFAULT_INITIAL_NODES: DAGNode[] = [
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
        url: "https://api.internal.corp/billing/{{trigger.body.customerId}}",
        method: "GET",
        headers: {
          Authorization: "Bearer token_corp_secret",
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
];

const DEFAULT_INITIAL_EDGES: DAGEdge[] = [
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
];

function WorkflowCanvasInner({
  workflowId,
  initialName,
  initialStatus,
  initialNodes = DEFAULT_INITIAL_NODES,
  initialEdges = DEFAULT_INITIAL_EDGES,
  session,
}: WorkflowCanvasProps) {
  const t = useTranslations("workflow");
  const tValidation = useTranslations("validation");

  const [workflowName, setWorkflowName] = useState(initialName);
  const [workflowStatus, setWorkflowStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialNodes as unknown as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges as unknown as Edge[]
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // Register custom node & edge types
  const nodeTypes = useMemo(
    () => ({
      workflowNode: CustomWorkflowNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      workflowEdge: CustomWorkflowEdge,
    }),
    []
  );

  // Active DAG Validation
  const dagValidation = useMemo(() => {
    return validateDAG(
      nodes as unknown as DAGNode[],
      edges as unknown as DAGEdge[]
    );
  }, [nodes, edges]);

  // Connect edge handler with immediate cycle check
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge_${params.source}_${params.target}_${Date.now()}`,
        type: "workflowEdge",
      };

      const candidateEdges = [...edges, newEdge];
      const check = validateDAG(
        nodes as unknown as DAGNode[],
        candidateEdges as unknown as DAGEdge[]
      );

      if (check.hasCycle) {
        toast.error(tValidation("dagCycleDetected"), {
          description: tValidation("cyclePath", {
            path: check.cycleNodes?.join(" → ") || "",
          }),
        });
        return;
      }

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [edges, nodes, setEdges, tValidation]
  );

  // Node Selection Handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Adding node from palette (Click or Drag Drop)
  const handleAddNode = useCallback(
    (type: WorkflowNodeType, position?: { x: number; y: number }) => {
      const newId = `node_${type}_${Date.now().toString().slice(-5)}`;
      const labels: Record<WorkflowNodeType, string> = {
        trigger: "Manual Ingestion Trigger",
        webhook: "Inbound Webhook",
        action: "HTTP Request Action",
        filter: "Boolean Filter Gate",
      };

      const defaultConfigs: Record<WorkflowNodeType, Record<string, unknown>> = {
        trigger: { payload: { timestamp: Date.now() } },
        webhook: { path: `wh-${newId}`, secretHeader: "" },
        action: {
          url: "https://api.example.com/v1/resource",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { eventId: "{{trigger.body.id}}" },
        },
        filter: {
          field: "{{trigger.body.tier}}",
          operator: "equals",
          value: "enterprise",
        },
      };

      const pos = position || {
        x: 300 + Math.floor(Math.random() * 80) - 40,
        y: 200 + nodes.length * 60,
      };

      const newNode: DAGNode = {
        id: newId,
        type: "workflowNode",
        position: pos,
        data: {
          label: labels[type],
          type,
          description: `Configured ${type} pipeline step`,
          config: defaultConfigs[type],
        },
      };

      setNodes((nds) => [...nds, newNode as unknown as Node]);
      setSelectedNodeId(newId);
      toast.success(`Added ${labels[type]}`);
    },
    [nodes.length, setNodes]
  );

  // Drag and Drop canvas handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData(
        "application/reactflow"
      ) as WorkflowNodeType;

      if (!nodeType || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      handleAddNode(nodeType, position);
    },
    [handleAddNode, reactFlowInstance]
  );

  // Node Inspector updates
  const handleUpdateNode = useCallback(
    (nodeId: string, updatedData: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...(n.data as unknown as NodeData),
                ...updatedData,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      toast.info(`Node ${nodeId} deleted`);
    },
    [selectedNodeId, setEdges, setNodes]
  );

  // Reset execution highlighting
  const handleResetExecution = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...(n.data as unknown as NodeData),
          executionState: undefined,
          executionError: undefined,
          executionDurationMs: undefined,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...(e.data || {}),
          executionState: undefined,
          isAnimatedFlow: false,
        },
      }))
    );
  }, [setEdges, setNodes]);

  // Save Workflow Action with Server Action persistence & strict cycle validation
  const handleSave = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"), {
        description: tValidation("cyclePath", {
          path: dagValidation.cycleNodes?.join(" → ") || "",
        }),
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveWorkflowAction({
        id: workflowId,
        name: workflowName,
        status: workflowStatus,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data as unknown as NodeData,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        })),
      });

      if (!result.success) {
        toast.error(result.error || tValidation("saveFailed"));
      } else {
        toast.success(tValidation("savedSuccess"));
      }
    } catch {
      toast.error(tValidation("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [
    dagValidation,
    nodes,
    edges,
    workflowName,
    workflowId,
    workflowStatus,
    tValidation,
  ]);

  // Publish Workflow Action
  const handlePublish = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"));
      return;
    }

    setIsPublishing(true);
    try {
      await handleSave();
      const res = await publishWorkflowAction(workflowId);
      if (res.success) {
        setWorkflowStatus("PUBLISHED");
        toast.success(tValidation("publishedSuccess"));
      } else {
        toast.error(res.error || "Failed to publish workflow");
      }
    } catch {
      toast.error("Error occurred while publishing workflow.");
    } finally {
      setIsPublishing(false);
    }
  }, [dagValidation, handleSave, workflowId, tValidation]);

  // Replay historical execution on the visual canvas
  const handleReplayExecution = useCallback(
    (exec: WorkflowExecutionRecord) => {
      setNodes((nds) =>
        nds.map((n) => {
          const step = exec.steps.find((s) => s.nodeId === n.id);
          if (step) {
            return {
              ...n,
              data: {
                ...(n.data as unknown as NodeData),
                executionState: step.status,
                executionError: step.errorMessage || undefined,
                executionDurationMs: step.durationMs || undefined,
              },
            };
          }
          return n;
        })
      );

      setEdges((eds) =>
        eds.map((e) => {
          const targetStep = exec.steps.find((s) => s.nodeId === e.target);
          return {
            ...e,
            data: {
              ...(e.data || {}),
              executionState: targetStep?.status || "SUCCESS",
              isAnimatedFlow: false,
            },
          };
        })
      );

      toast.info(`Replaying execution audit log: ${exec.id}`);
    },
    [setEdges, setNodes]
  );

  // Auto-Layout DAG hierarchical coordinates
  const handleAutoLayout = useCallback(() => {
    const tidied = autoLayoutDAG(
      nodes as unknown as DAGNode[],
      edges as unknown as DAGEdge[]
    );
    setNodes(tidied as unknown as Node[]);
    toast.success("DAG visual hierarchy auto-aligned");
  }, [edges, nodes, setNodes]);

  // Export Workflow Blueprint as JSON
  const handleExportJSON = useCallback(() => {
    const exportData = {
      name: workflowName,
      status: workflowStatus,
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexusflow_${workflowName.toLowerCase().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workflow blueprint exported as JSON");
  }, [workflowName, workflowStatus, nodes, edges]);

  // Import Workflow Blueprint from JSON
  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          toast.error("Invalid blueprint format: missing nodes/edges arrays.");
          return;
        }
        const validation = validateDAG(parsed.nodes, parsed.edges);
        if (validation.hasCycle) {
          toast.error("Import rejected: circular loops detected in blueprint.");
          return;
        }
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        if (parsed.name) setWorkflowName(parsed.name);
        toast.success("Workflow blueprint imported successfully!");
      } catch {
        toast.error("Failed to parse blueprint JSON file.");
      }
    };
    input.click();
  }, [setNodes, setEdges]);

  // Load Preset Template
  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      const tmpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!tmpl) return;
      setNodes(tmpl.nodes as unknown as Node[]);
      setEdges(tmpl.edges as unknown as Edge[]);
      setWorkflowName(tmpl.name);
      toast.success(`Loaded template: ${tmpl.name}`);
    },
    [setNodes, setEdges]
  );

  // Execute Test Run with Live DAG Replay
  const handleExecuteTest = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"));
      return;
    }

    if (nodes.length === 0) {
      toast.warning(t("canvas.emptyCanvas"));
      return;
    }

    setIsExecuting(true);
    handleResetExecution();
    toast.info(tValidation("executionStarted"));

    try {
      // 1. Topological Sorting Kahn's algorithm
      const { sortedNodeIds } = getTopologicalOrder(
        nodes as unknown as DAGNode[],
        edges as unknown as DAGEdge[]
      );

      // 2. Prepare Context
      const context: ExecutionContext = {
        trigger: {
          body: {
            customerId: "cust_9824",
            tier: "enterprise",
            email: "jane.doe@enterprise.io",
          },
        },
        steps: {},
      };

      // 3. Sequentially step through nodes in topological dependency order
      for (let i = 0; i < sortedNodeIds.length; i++) {
        const currentNodeId = sortedNodeIds[i];

        // Animate incoming edge
        setEdges((eds) =>
          eds.map((e) =>
            e.target === currentNodeId
              ? {
                  ...e,
                  data: {
                    ...e.data,
                    executionState: "RUNNING",
                    isAnimatedFlow: true,
                  },
                }
              : e
          )
        );

        // Mark Node as Running
        setNodes((nds) =>
          nds.map((n) =>
            n.id === currentNodeId
              ? {
                  ...n,
                  data: {
                    ...(n.data as unknown as NodeData),
                    executionState: "RUNNING",
                  },
                }
              : n
          )
        );

        // Execution step simulation delay
        const stepStart = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 800));
        const duration = Math.round(performance.now() - stepStart);

        // Find current node config & resolve variable interpolation
        const nodeItem = nodes.find((n) => n.id === currentNodeId);
        const nodeData = nodeItem?.data as unknown as NodeData;
        const resolvedConfig = interpolateVariables(
          nodeData?.config || {},
          context
        );

        // Register output in context
        if (context.steps) {
          context.steps[currentNodeId] = {
            output: {
              success: true,
              data: resolvedConfig,
            },
            status: "SUCCESS",
          };
        }

        // Mark Node as Success
        setNodes((nds) =>
          nds.map((n) =>
            n.id === currentNodeId
              ? {
                  ...n,
                  data: {
                    ...(n.data as unknown as NodeData),
                    executionState: "SUCCESS",
                    executionDurationMs: duration,
                  },
                }
              : n
          )
        );

        // Update incoming edge to success
        setEdges((eds) =>
          eds.map((e) =>
            e.target === currentNodeId
              ? {
                  ...e,
                  data: {
                    ...e.data,
                    executionState: "SUCCESS",
                    isAnimatedFlow: false,
                  },
                }
              : e
          )
        );
      }

      toast.success(tValidation("publishedSuccess"), {
        description: "All DAG steps executed successfully in topological order.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      toast.error(tValidation("executionFailed"), {
        description: msg,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [
    dagValidation,
    edges,
    handleResetExecution,
    nodes,
    setEdges,
    setNodes,
    t,
    tValidation,
  ]);

  // Dispatch Real-time Live Queue Execution with Server-Sent Events (SSE) Stream
  const handleDispatchLiveQueue = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"));
      return;
    }

    if (nodes.length === 0) {
      toast.warning(t("canvas.emptyCanvas"));
      return;
    }

    setIsExecuting(true);
    handleResetExecution();
    toast.info("Enqueuing job to BullMQ queue...");

    try {
      // 1. Ensure latest canvas layout is persisted
      await handleSave();

      // 2. Extract trigger payload if available
      const triggerNode = nodes.find(
        (n) => (n.data as unknown as NodeData).type === "trigger"
      );
      const rawPayload =
        (triggerNode?.data as unknown as NodeData)?.config?.payload || {
          manualTrigger: true,
          timestamp: Date.now(),
        };

      const triggerPayload: Record<string, unknown> =
        typeof rawPayload === "object" && rawPayload !== null
          ? (rawPayload as Record<string, unknown>)
          : { value: rawPayload };

      // 3. Dispatch to background queue via Server Action
      const result = await triggerWorkflowExecutionAction(
        workflowId,
        triggerPayload
      );

      if (!result.success || !result.executionId) {
        toast.error(result.error || "Failed to enqueue workflow job.");
        setIsExecuting(false);
        return;
      }

      toast.success(
        `Job queued (${result.mode || "distributed"}). Streaming real-time telemetry...`
      );

      // 4. Connect to Server-Sent Events (SSE) Stream
      const streamUrl = `/api/workflows/${workflowId}/executions/${result.executionId}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("step_recorded", (e) => {
        try {
          const step = JSON.parse(e.data);
          const nodeId = step.nodeId as string;
          const status = step.status as string;
          const duration = step.durationMs as number | undefined;

          // Update node state
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...(n.data as unknown as NodeData),
                      executionState: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
                      executionDurationMs: duration,
                      executionError: step.errorMessage || undefined,
                    },
                  }
                : n
            )
          );

          // Update edge state
          setEdges((eds) =>
            eds.map((edge) =>
              edge.target === nodeId
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      executionState: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
                      isAnimatedFlow: status === "RUNNING",
                    },
                  }
                : edge
            )
          );
        } catch {
          // Ignore parse errors on malformed chunks
        }
      });

      eventSource.addEventListener("completed", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === "SUCCESS") {
            toast.success("Distributed execution completed via worker!", {
              description: `Execution ID: ${result.executionId}`,
            });
          } else {
            toast.error("Distributed execution completed with errors.", {
              description: `Execution ID: ${result.executionId}`,
            });
          }
        } finally {
          eventSource.close();
          setIsExecuting(false);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        setIsExecuting(false);
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dispatch failed";
      toast.error(msg);
      setIsExecuting(false);
    }
  }, [
    dagValidation,
    nodes,
    handleResetExecution,
    handleSave,
    workflowId,
    setNodes,
    setEdges,
    t,
    tValidation,
  ]);

  // Stream live execution initiated via Webhook Simulator or external API
  const handleStreamExecutionById = useCallback(
    (execId: string) => {
      setIsExecuting(true);
      handleResetExecution();
      toast.info(`Connecting to live SSE telemetry stream for ${execId}...`);

      const streamUrl = `/api/workflows/${workflowId}/executions/${execId}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("step_recorded", (e) => {
        try {
          const step = JSON.parse(e.data);
          const nodeId = step.nodeId as string;
          const status = step.status as string;
          const duration = step.durationMs as number | undefined;

          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...(n.data as unknown as NodeData),
                      executionState: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
                      executionDurationMs: duration,
                      executionError: step.errorMessage || undefined,
                    },
                  }
                : n
            )
          );

          setEdges((eds) =>
            eds.map((edge) =>
              edge.target === nodeId
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      executionState: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
                      isAnimatedFlow: status === "RUNNING",
                    },
                  }
                : edge
            )
          );
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener("completed", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === "SUCCESS") {
            toast.success("Live webhook execution finished successfully!", {
              description: `Execution ID: ${execId}`,
            });
          } else {
            toast.error("Execution finished with errors.", {
              description: `Execution ID: ${execId}`,
            });
          }
        } finally {
          eventSource.close();
          setIsExecuting(false);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        setIsExecuting(false);
      };
    },
    [handleResetExecution, setEdges, setNodes, workflowId]
  );

  // Canvas Keyboard Shortcuts (Ctrl+S for save, Ctrl+Enter for run test, Escape to close inspector)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecuteTest();
      } else if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleExecuteTest]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const found = nodes.find((n) => n.id === selectedNodeId);
    return found ? (found as unknown as DAGNode) : null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Top Navigation */}
      <WorkflowNavbar
        workflowId={workflowId}
        workflowName={workflowName}
        workflowStatus={workflowStatus}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isExecuting={isExecuting}
        hasCycleError={dagValidation.hasCycle}
        session={session}
        onNameChange={setWorkflowName}
        onSave={handleSave}
        onPublish={handlePublish}
        onExecuteTest={handleExecuteTest}
        onDispatchQueue={handleDispatchLiveQueue}
        onResetExecution={handleResetExecution}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenWebhookConsole={() => setIsWebhookModalOpen(true)}
        onAutoLayout={handleAutoLayout}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Drag/Drop Palette */}
        <NodePalette
          onAddNode={(type) => handleAddNode(type)}
          isOpenMobile={isMobilePaletteOpen}
          onCloseMobile={() => setIsMobilePaletteOpen(false)}
          isCollapsed={isPaletteCollapsed}
          onToggleCollapse={() => setIsPaletteCollapsed((c) => !c)}
        />

        {/* Central Infinite Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 h-full w-full relative bg-zinc-950"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {/* Mobile Floating Action Button to Add Steps */}
          <div className="md:hidden absolute top-3 left-3 z-20">
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsMobilePaletteOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-1.5 shadow-xl text-xs h-8 px-2.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Step</span>
            </Button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{
              type: "workflowEdge",
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="#27272a"
            />
            <Controls className="!bottom-4 !left-4" showInteractive={false} />
            <MiniMap
              className="!bottom-4 !right-4 !hidden md:!block"
              nodeStrokeColor="#3f3f46"
              nodeColor="#18181b"
              maskColor="rgba(9, 9, 11, 0.75)"
            />
          </ReactFlow>

          {/* Mobile Screen Guidance */}
          <MobileWarningBanner />
        </div>

        {/* Slide-over Inspector Sheet / Drawer */}
        <NodeInspector
          selectedNode={selectedNode}
          allNodes={nodes as unknown as DAGNode[]}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      {/* Execution Telemetry History Modal */}
      <ExecutionHistoryModal
        workflowId={workflowId}
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onReplayExecution={handleReplayExecution}
      />

      {/* Inbound Webhook Simulator Console Modal */}
      <WebhookConsoleModal
        workflowId={workflowId}
        nodes={nodes as unknown as DAGNode[]}
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        onStreamExecution={handleStreamExecutionById}
      />
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
