"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect, useDeferredValue } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  BackgroundVariant,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { Layers, Play, Webhook } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { CustomWorkflowNode } from "./custom-node";
import { CustomWorkflowEdge, EdgeMarkers } from "./custom-edge";
import { NodePalette } from "./node-palette";
import { NodeInspector, type InspectorTab } from "./node-inspector";
import { WorkflowNavbar } from "./workflow-navbar";
import { MobileTip } from "./mobile-warning";
import { CanvasToolbar } from "./canvas-toolbar";
import { NodePicker } from "./node-picker";
import { RunPanel, type RunLog } from "./run-panel";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { CanvasUIProvider, type NodeAction } from "./canvas-context";
import { useCanvasHistory } from "./hooks/use-canvas-history";
import { NODE_META, STEP_NODE_TYPES, asNodeType, defaultConfig } from "./node-meta";
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
  getSingleExecutionAction,
  setWorkflowStatusAction,
  deleteWorkflowAction,
} from "@/lib/actions/workflow-actions";
import { listCredentialsAction } from "@/lib/actions/credential-actions";
import { ExecutionHistoryModal } from "./execution-history-modal";
import { WebhookConsoleModal } from "./webhook-console-modal";
import type { WorkflowExecutionRecord } from "@/lib/services/execution-service";
import type { SessionUser } from "@/lib/services/auth-service";
import { useExecutionStream, type StreamStep } from "@/hooks/use-execution-stream";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";

interface WorkflowCanvasProps {
  workflowId: string;
  initialName: string;
  initialStatus: "DRAFT" | "PUBLISHED" | "DISABLED";
  initialNodes?: DAGNode[];
  initialEdges?: DAGEdge[];
  session?: SessionUser | null;
  /** A workflow that hasn't been saved yet (from the template gallery). */
  isNew?: boolean;
  /** Execution to replay on load (deep link from the Runs page). */
  replayExecutionId?: string | null;
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
        url: "https://api.internal.corp/billing/{{trigger.body.customerId}}",
        method: "GET",
        headers: { Authorization: "Bearer token_corp_secret" },
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
];

const DEFAULT_INITIAL_EDGES: DAGEdge[] = [
  { id: "edge_trigger_to_action", source: "node_trigger_1", target: "node_action_1", type: "workflowEdge" },
  { id: "edge_action_to_filter", source: "node_action_1", target: "node_filter_1", type: "workflowEdge" },
];

const NODE_WIDTH = 260;
const FIT_OPTIONS = { padding: 0.3, maxZoom: 1 } as const;

type PickerIntent =
  | { kind: "add"; flowPos?: { x: number; y: number } }
  | { kind: "connect"; fromId: string; fromHandle: "source" | "target"; flowPos: { x: number; y: number } }
  | { kind: "insert"; edgeId: string };

type PendingReplace =
  | { kind: "template"; templateId: string }
  | { kind: "import"; nodes: Node[]; edges: Edge[]; name?: string }
  | null;

/** Stable fingerprint of what gets saved (ignores run state / measurements). */
function computeSignature(name: string, nodes: { id: string; position?: { x: number; y: number }; data: unknown }[], edges: { id: string; source: string; target: string }[]) {
  return JSON.stringify([
    name,
    nodes.map((n) => {
      const d = n.data as NodeData;
      return [n.id, Math.round(n.position?.x ?? 0), Math.round(n.position?.y ?? 0), d?.label, d?.description, d?.type, d?.config];
    }),
    edges.map((e) => [e.id, e.source, e.target]),
  ]);
}

function readPref<T>(key: string, fallback: T, parse: (v: string) => T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : parse(v);
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // per-viewer convenience only
  }
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || Boolean(el.closest?.(".cm-editor"));
}

function WorkflowCanvasInner({
  workflowId,
  initialName,
  initialStatus,
  initialNodes = DEFAULT_INITIAL_NODES,
  initialEdges = DEFAULT_INITIAL_EDGES,
  session,
  isNew = false,
  replayExecutionId,
}: WorkflowCanvasProps) {
  const t = useTranslations("editor");
  const tToast = useTranslations("editor.toasts");
  const tNodes = useTranslations("nodes");
  const tStatus = useTranslations("status");
  const tValidation = useTranslations("validation");
  const router = useRouter();
  const rf = useReactFlow();
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery(BREAKPOINTS.md, true);

  const [workflowName, setWorkflowName] = useState(initialName);
  const [workflowStatus, setWorkflowStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("configure");
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(380);
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ intent: PickerIntent; at: { x: number; y: number } | null } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<PendingReplace>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [credentialNames, setCredentialNames] = useState<string[]>([]);
  const [modKey, setModKey] = useState("Ctrl ");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes as unknown as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges as unknown as Edge[]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const history = useCanvasHistory(nodes, edges, setNodes, setEdges);
  const { takeSnapshot } = history;
  const { start: startStream } = useExecutionStream();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ workflowNode: CustomWorkflowNode }), []);
  const edgeTypes = useMemo(() => ({ workflowEdge: CustomWorkflowEdge }), []);

  // ---- Preferences & environment -----------------------------------------
  useEffect(() => {
    setIsPaletteCollapsed(readPref("nf-palette-collapsed", false, (v) => v === "1"));
    setInspectorWidth(readPref("nf-inspector-width", 380, (v) => Math.min(580, Math.max(320, Number(v) || 380))));
    setModKey(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ");
    listCredentialsAction()
      .then((list) => setCredentialNames(list.map((c) => c.name)))
      .catch(() => {});
  }, []);

  const log = useCallback((level: RunLog["level"], message: string) => {
    setLogs((prev) => [...prev.slice(-199), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), level, message }]);
  }, []);

  const labelOf = useCallback(
    (nodeId: string) => (nodesRef.current.find((n) => n.id === nodeId)?.data as unknown as NodeData | undefined)?.label || nodeId,
    []
  );

  // ---- Validation & dirty state --------------------------------------------
  const dagValidation = useMemo(
    () => validateDAG(nodes as unknown as DAGNode[], edges as unknown as DAGEdge[]),
    [nodes, edges]
  );
  const cycleNodeIds = useMemo(
    () => new Set(dagValidation.hasCycle ? dagValidation.cycleNodes ?? [] : []),
    [dagValidation]
  );

  const deferredNodes = useDeferredValue(nodes);
  const deferredEdges = useDeferredValue(edges);
  const signature = useMemo(
    () => computeSignature(workflowName, deferredNodes as unknown as DAGNode[], deferredEdges),
    [workflowName, deferredNodes, deferredEdges]
  );
  const [savedSignature, setSavedSignature] = useState(() =>
    isNew ? "" : computeSignature(initialName, initialNodes, initialEdges)
  );
  const isDirty = signature !== savedSignature;
  const saveState = isSaving ? "saving" : isDirty ? "unsaved" : "saved";

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Drop selection if the node disappears (delete, undo, template…).
  useEffect(() => {
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null);
  }, [nodes, selectedNodeId]);

  const fitSoon = useCallback(() => {
    requestAnimationFrame(() => rf.fitView({ ...FIT_OPTIONS, duration: reduceMotion ? 0 : 400 }));
  }, [rf, reduceMotion]);

  // ---- Graph editing ----------------------------------------------------------
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge_${params.source}_${params.target}_${Date.now()}`,
        type: "workflowEdge",
      };

      const check = validateDAG(nodes as unknown as DAGNode[], [...edges, newEdge] as unknown as DAGEdge[]);
      if (check.hasCycle) {
        toast.error(tValidation("dagCycleDetected"), {
          description: tValidation("cyclePath", { path: check.cycleNodes?.join(" → ") || "" }),
        });
        return;
      }

      takeSnapshot();
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [edges, nodes, setEdges, tValidation, takeSnapshot]
  );

  const buildNode = useCallback(
    (type: WorkflowNodeType, position: { x: number; y: number }): Node => {
      const newId = `node_${type}_${Date.now().toString().slice(-5)}`;
      const data: NodeData = {
        label: tNodes(`${type}.defaultLabel`),
        type,
        description: "",
        config: defaultConfig(type, newId),
      };
      return { id: newId, type: "workflowNode", position, data: data as unknown as Record<string, unknown>, selected: true };
    },
    [tNodes]
  );

  /** Flow-space point at the visual centre of the canvas, nudged so repeated adds cascade. */
  const viewportCenter = useCallback(() => {
    const rect = reactFlowWrapper.current?.getBoundingClientRect();
    const center = rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 300, y: 200 };
    const nudge = (nodesRef.current.length % 5) * 24;
    return { x: center.x - NODE_WIDTH / 2 + nudge, y: center.y - 50 + nudge };
  }, [rf]);

  const insertNodes = useCallback(
    (newNode: Node, extraEdges: Edge[] = [], removeEdgeId?: string) => {
      takeSnapshot();
      setNodes((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), newNode]);
      if (extraEdges.length || removeEdgeId) {
        setEdges((eds) => [...eds.filter((e) => e.id !== removeEdgeId), ...extraEdges]);
      }
      setSelectedNodeId(newNode.id);
      setInspectorTab("configure");
      toast.success(t("node.added", { label: (newNode.data as unknown as NodeData).label }));
    },
    [setEdges, setNodes, t, takeSnapshot]
  );

  // Adding node from palette (click or drag & drop) — same defaults as before.
  const handleAddNode = useCallback(
    (type: WorkflowNodeType, position?: { x: number; y: number }) => {
      insertNodes(buildNode(type, position ?? viewportCenter()));
    },
    [buildNode, insertNodes, viewportCenter]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/reactflow") as WorkflowNodeType;
      if (!nodeType) return;
      const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      handleAddNode(nodeType, { x: position.x - NODE_WIDTH / 2, y: position.y - 30 });
    },
    [handleAddNode, rf]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, updatedData: Partial<NodeData>) => {
      takeSnapshot({ coalesceMs: 800 });
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as unknown as NodeData), ...updatedData } } : n))
      );
    },
    [setNodes, takeSnapshot]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      takeSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      toast(t("node.deleted"), { action: { label: t("node.undo"), onClick: () => history.undo() } });
    },
    [history, selectedNodeId, setEdges, setNodes, t, takeSnapshot]
  );

  const handleDuplicate = useCallback(
    (nodeId: string) => {
      const src = nodesRef.current.find((n) => n.id === nodeId);
      if (!src) return;
      const data = src.data as unknown as NodeData;
      const type = asNodeType(data.type);
      const copy = buildNode(type, { x: src.position.x + 40, y: src.position.y + 40 });
      copy.data = {
        ...(data as unknown as Record<string, unknown>),
        executionState: undefined,
        executionError: undefined,
        executionDurationMs: undefined,
        config: structuredClone(data.config ?? {}),
      };
      insertNodes(copy);
    },
    [buildNode, insertNodes]
  );

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      takeSnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges, takeSnapshot]
  );

  const openPicker = useCallback((intent: PickerIntent, at: { x: number; y: number } | null = null) => {
    setPicker({ intent, at });
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || !state.fromNode || state.toNode) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const flowPos = rf.screenToFlowPosition({ x: point.clientX, y: point.clientY });
      openPicker(
        {
          kind: "connect",
          fromId: state.fromNode.id,
          fromHandle: state.fromHandle?.type === "target" ? "target" : "source",
          flowPos,
        },
        { x: point.clientX, y: point.clientY }
      );
    },
    [openPicker, rf]
  );

  const handlePick = useCallback(
    (type: WorkflowNodeType) => {
      const current = picker;
      setPicker(null);
      if (!current) return;
      const { intent } = current;

      if (intent.kind === "add") {
        const pos = intent.flowPos ? { x: intent.flowPos.x - NODE_WIDTH / 2, y: intent.flowPos.y - 30 } : viewportCenter();
        insertNodes(buildNode(type, pos));
        return;
      }

      if (intent.kind === "connect") {
        const node = buildNode(type, { x: intent.flowPos.x - NODE_WIDTH / 2, y: intent.flowPos.y - (intent.fromHandle === "source" ? 10 : 90) });
        const edge: Edge =
          intent.fromHandle === "source"
            ? { id: `edge_${intent.fromId}_${node.id}_${Date.now()}`, source: intent.fromId, target: node.id, type: "workflowEdge" }
            : { id: `edge_${node.id}_${intent.fromId}_${Date.now()}`, source: node.id, target: intent.fromId, type: "workflowEdge" };
        insertNodes(node, [edge]);
        return;
      }

      // Insert into an existing edge: A → B  becomes  A → new → B
      const edge = edges.find((e) => e.id === intent.edgeId);
      if (!edge) return;
      const a = nodesRef.current.find((n) => n.id === edge.source);
      const b = nodesRef.current.find((n) => n.id === edge.target);
      if (!a || !b) return;
      const node = buildNode(type, { x: (a.position.x + b.position.x) / 2 + 24, y: (a.position.y + b.position.y) / 2 });
      const stamp = Date.now();
      insertNodes(
        node,
        [
          { id: `edge_${a.id}_${node.id}_${stamp}`, source: a.id, target: node.id, type: "workflowEdge" },
          { id: `edge_${node.id}_${b.id}_${stamp}`, source: node.id, target: b.id, type: "workflowEdge" },
        ],
        edge.id
      );
    },
    [buildNode, edges, insertNodes, picker, viewportCenter]
  );

  const pickerAllowed: WorkflowNodeType[] | undefined =
    picker && (picker.intent.kind === "insert" || (picker.intent.kind === "connect" && picker.intent.fromHandle === "source"))
      ? STEP_NODE_TYPES
      : undefined;

  // ---- Execution state helpers ------------------------------------------------
  const handleResetExecution = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...(n.data as unknown as NodeData), executionState: undefined, executionError: undefined, executionDurationMs: undefined },
      }))
    );
    setEdges((eds) => eds.map((e) => ({ ...e, data: { ...(e.data || {}), executionState: undefined, isAnimatedFlow: false } })));
  }, [setEdges, setNodes]);

  const applyStreamStep = useCallback(
    (step: StreamStep) => {
      const { nodeId, status } = step;
      const duration = step.durationMs ?? undefined;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as unknown as NodeData),
                  executionState: status,
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
            ? { ...edge, data: { ...edge.data, executionState: status, isAnimatedFlow: status === "RUNNING" } }
            : edge
        )
      );
      log(
        status === "FAILED" ? "error" : status === "SUCCESS" ? "success" : status === "RUNNING" ? "running" : "info",
        `${labelOf(nodeId)} — ${tStatus(status)}${duration !== undefined ? ` (${duration}ms)` : ""}${step.errorMessage ? `: ${step.errorMessage}` : ""}`
      );
    },
    [labelOf, log, setEdges, setNodes, tStatus]
  );

  // ---- Save / publish (same server actions & payload as before) -----------------
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"), {
        description: tValidation("cyclePath", { path: dagValidation.cycleNodes?.join(" → ") || "" }),
      });
      return false;
    }

    setIsSaving(true);
    const snapshotSignature = computeSignature(workflowName, nodes as unknown as DAGNode[], edges);
    try {
      const result = await saveWorkflowAction({
        id: workflowId,
        name: workflowName,
        status: workflowStatus,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data as unknown as NodeData })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
      });

      if (!result.success) {
        toast.error(result.error || tValidation("saveFailed"));
        return false;
      }
      setSavedSignature(snapshotSignature);
      toast.success(tValidation("savedSuccess"));
      return true;
    } catch {
      toast.error(tValidation("saveFailed"));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [dagValidation, nodes, edges, workflowName, workflowId, workflowStatus, tValidation]);

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
        toast.error(res.error || tToast("publishFailed"));
      }
    } catch {
      toast.error(tToast("publishFailed"));
    } finally {
      setIsPublishing(false);
    }
  }, [dagValidation, handleSave, workflowId, tValidation, tToast]);

  // ---- Enable / disable / delete ---------------------------------------------------
  const handleToggleEnabled = useCallback(async () => {
    const next = workflowStatus === "DISABLED" ? "PUBLISHED" : "DISABLED";
    const res = await setWorkflowStatusAction(workflowId, next);
    if (!res.success) {
      toast.error(res.error || tToast("statusFailed"));
      return;
    }
    setWorkflowStatus(next);
    toast.success(next === "DISABLED" ? tToast("workflowDisabled") : tToast("workflowEnabled"));
  }, [tToast, workflowId, workflowStatus]);

  const handleDeleteWorkflow = useCallback(async () => {
    const res = await deleteWorkflowAction(workflowId);
    if (!res.success) {
      toast.error(res.error || tToast("deleteFailed"));
      return;
    }
    toast.success(tToast("workflowDeleted"));
    setSavedSignature(signature);
    router.push("/");
  }, [router, signature, tToast, workflowId]);

  // ---- Replay a historical execution on the canvas -------------------------------
  const handleReplayExecution = useCallback(
    (exec: WorkflowExecutionRecord) => {
      setNodes((nds) =>
        nds.map((n) => {
          const step = exec.steps.find((s) => s.nodeId === n.id);
          if (!step) return n;
          return {
            ...n,
            data: {
              ...(n.data as unknown as NodeData),
              executionState: step.status,
              executionError: step.errorMessage || undefined,
              executionDurationMs: step.durationMs || undefined,
            },
          };
        })
      );
      setEdges((eds) =>
        eds.map((e) => {
          const targetStep = exec.steps.find((s) => s.nodeId === e.target);
          return { ...e, data: { ...(e.data || {}), executionState: targetStep?.status || "SUCCESS", isAnimatedFlow: false } };
        })
      );
      setRunPanelOpen(true);
      log("info", tToast("replay", { id: exec.id }));
      for (const step of exec.steps) {
        log(
          step.status === "FAILED" ? "error" : step.status === "SUCCESS" ? "success" : "info",
          `${step.nodeId} — ${tStatus(step.status)}${step.durationMs ? ` (${step.durationMs}ms)` : ""}`
        );
      }
      toast.info(tToast("replay", { id: exec.id }));
    },
    [log, setEdges, setNodes, tStatus, tToast]
  );

  const replayRequested = useRef(false);
  useEffect(() => {
    if (!replayExecutionId || replayRequested.current) return;
    replayRequested.current = true;
    getSingleExecutionAction(replayExecutionId)
      .then((exec) => exec && handleReplayExecution(exec))
      .catch(() => {});
  }, [replayExecutionId, handleReplayExecution]);

  // ---- Layout (animated) ---------------------------------------------------------
  const animatePositions = useCallback(
    (targets: Map<string, { x: number; y: number }>) =>
      new Promise<void>((resolve) => {
        if (reduceMotion) {
          setNodes((nds) => nds.map((n) => (targets.has(n.id) ? { ...n, position: targets.get(n.id)! } : n)));
          resolve();
          return;
        }
        const from = new Map(nodesRef.current.map((n) => [n.id, n.position]));
        const start = performance.now();
        const D = 460;
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / D);
          const e = 1 - Math.pow(1 - p, 3);
          setNodes((nds) =>
            nds.map((n) => {
              const a = from.get(n.id);
              const b = targets.get(n.id);
              if (!a || !b) return n;
              return { ...n, position: { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e } };
            })
          );
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [reduceMotion, setNodes]
  );

  const handleAutoLayout = useCallback(async () => {
    const tidied = autoLayoutDAG(nodes as unknown as DAGNode[], edges as unknown as DAGEdge[]);
    takeSnapshot();
    await animatePositions(new Map(tidied.map((n) => [n.id, n.position ?? { x: 0, y: 0 }])));
    fitSoon();
    toast.success(tToast("layout"));
  }, [animatePositions, edges, fitSoon, nodes, tToast, takeSnapshot]);

  // ---- Export / import / templates --------------------------------------------------
  const handleExportJSON = useCallback(() => {
    const exportData = { name: workflowName, status: workflowStatus, exportedAt: new Date().toISOString(), nodes, edges };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexusflow_${workflowName.toLowerCase().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(tToast("exported"));
  }, [workflowName, workflowStatus, nodes, edges, tToast]);

  const applyReplace = useCallback(
    (replace: Exclude<PendingReplace, null>) => {
      takeSnapshot();
      if (replace.kind === "import") {
        setNodes(replace.nodes);
        setEdges(replace.edges);
        if (replace.name) setWorkflowName(replace.name);
        toast.success(tToast("imported"));
      } else {
        const tmpl = WORKFLOW_TEMPLATES.find((tpl) => tpl.id === replace.templateId);
        if (!tmpl) return;
        setNodes(tmpl.nodes as unknown as Node[]);
        setEdges(tmpl.edges as unknown as Edge[]);
        setWorkflowName(tmpl.name);
        toast.success(tToast("templateLoaded", { name: tmpl.name }));
      }
      setSelectedNodeId(null);
      fitSoon();
    },
    [fitSoon, setEdges, setNodes, tToast, takeSnapshot]
  );

  const requestReplace = useCallback(
    (replace: Exclude<PendingReplace, null>) => {
      if (nodesRef.current.length > 0) setPendingReplace(replace);
      else applyReplace(replace);
    },
    [applyReplace]
  );

  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          toast.error(tToast("importInvalid"));
          return;
        }
        if (validateDAG(parsed.nodes, parsed.edges).hasCycle) {
          toast.error(tToast("importCycle"));
          return;
        }
        requestReplace({ kind: "import", nodes: parsed.nodes, edges: parsed.edges, name: parsed.name });
      } catch {
        toast.error(tToast("importParse"));
      }
    };
    input.click();
  }, [requestReplace, tToast]);

  const handleSelectTemplate = useCallback(
    (templateId: string) => requestReplace({ kind: "template", templateId }),
    [requestReplace]
  );

  // ---- Test run: simulated topological replay (unchanged algorithm) -------------------
  const handleExecuteTest = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"));
      return;
    }
    if (nodes.length === 0) {
      toast.warning(t("empty.title"));
      return;
    }

    setIsExecuting(true);
    setRunPanelOpen(true);
    handleResetExecution();
    toast.info(tValidation("executionStarted"));
    log("info", t("run"));

    try {
      const { sortedNodeIds } = getTopologicalOrder(nodes as unknown as DAGNode[], edges as unknown as DAGEdge[]);
      const context: ExecutionContext = {
        trigger: { body: { customerId: "cust_9824", tier: "enterprise", email: "jane.doe@enterprise.io" } },
        steps: {},
      };

      for (const currentNodeId of sortedNodeIds) {
        setEdges((eds) =>
          eds.map((e) =>
            e.target === currentNodeId ? { ...e, data: { ...e.data, executionState: "RUNNING", isAnimatedFlow: true } } : e
          )
        );
        setNodes((nds) =>
          nds.map((n) =>
            n.id === currentNodeId ? { ...n, data: { ...(n.data as unknown as NodeData), executionState: "RUNNING" } } : n
          )
        );
        const nodeItem = nodes.find((n) => n.id === currentNodeId);
        const nodeData = nodeItem?.data as unknown as NodeData;
        log("running", `${nodeData?.label || currentNodeId} — ${tStatus("RUNNING")}`);

        const stepStart = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 800));
        const duration = Math.round(performance.now() - stepStart);

        const resolvedConfig = interpolateVariables(nodeData?.config || {}, context);
        if (context.steps) {
          context.steps[currentNodeId] = { output: { success: true, data: resolvedConfig }, status: "SUCCESS" };
        }

        setNodes((nds) =>
          nds.map((n) =>
            n.id === currentNodeId
              ? { ...n, data: { ...(n.data as unknown as NodeData), executionState: "SUCCESS", executionDurationMs: duration } }
              : n
          )
        );
        setEdges((eds) =>
          eds.map((e) =>
            e.target === currentNodeId ? { ...e, data: { ...e.data, executionState: "SUCCESS", isAnimatedFlow: false } } : e
          )
        );
        log("success", `${nodeData?.label || currentNodeId} — ${tStatus("SUCCESS")} (${duration}ms)`);
      }

      toast.success(tToast("runComplete"));
      log("success", tToast("runComplete"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      toast.error(tValidation("executionFailed"), { description: msg });
      log("error", msg);
    } finally {
      setIsExecuting(false);
    }
  }, [dagValidation, edges, handleResetExecution, log, nodes, setEdges, setNodes, t, tStatus, tToast, tValidation]);

  // ---- Dispatch to BullMQ + live SSE stream ---------------------------------------
  const streamExecution = useCallback(
    (execId: string, doneMessages: { ok: string; fail: string }) => {
      startStream(workflowId, execId, {
        onStep: applyStreamStep,
        onComplete: (status) => {
          if (status === "SUCCESS") {
            toast.success(doneMessages.ok, { description: tToast("executionId", { id: execId }) });
            log("success", doneMessages.ok);
          } else {
            toast.error(doneMessages.fail, { description: tToast("executionId", { id: execId }) });
            log("error", doneMessages.fail);
          }
          setIsExecuting(false);
        },
        onError: () => setIsExecuting(false),
      });
    },
    [applyStreamStep, log, startStream, tToast, workflowId]
  );

  const handleDispatchLiveQueue = useCallback(async () => {
    if (dagValidation.hasCycle) {
      toast.error(tValidation("dagCycleDetected"));
      return;
    }
    if (nodes.length === 0) {
      toast.warning(t("empty.title"));
      return;
    }

    setIsExecuting(true);
    setRunPanelOpen(true);
    handleResetExecution();
    toast.info(tToast("enqueueing"));
    log("info", tToast("enqueueing"));

    try {
      await handleSave();

      const triggerNode = nodes.find((n) => (n.data as unknown as NodeData).type === "trigger");
      const rawPayload = (triggerNode?.data as unknown as NodeData)?.config?.payload || { manualTrigger: true, timestamp: Date.now() };
      const triggerPayload: Record<string, unknown> =
        typeof rawPayload === "object" && rawPayload !== null ? (rawPayload as Record<string, unknown>) : { value: rawPayload };

      const result = await triggerWorkflowExecutionAction(workflowId, triggerPayload);
      if (!result.success || !result.executionId) {
        toast.error(result.error || tToast("queueFailed"));
        log("error", result.error || tToast("queueFailed"));
        setIsExecuting(false);
        return;
      }

      const queuedMsg = tToast("queued", { mode: result.mode || "distributed" });
      toast.success(queuedMsg);
      log("info", queuedMsg);
      streamExecution(result.executionId, { ok: tToast("streamDone"), fail: tToast("streamFailed") });
    } catch (err) {
      const msg = err instanceof Error ? err.message : tToast("dispatchFailed");
      toast.error(msg);
      log("error", msg);
      setIsExecuting(false);
    }
  }, [dagValidation, handleResetExecution, handleSave, log, nodes, streamExecution, t, tToast, tValidation, workflowId]);

  const handleStreamExecutionById = useCallback(
    (execId: string) => {
      setIsExecuting(true);
      setRunPanelOpen(true);
      handleResetExecution();
      const msg = tToast("streamConnecting", { id: execId });
      toast.info(msg);
      log("info", msg);
      streamExecution(execId, { ok: tToast("streamDone"), fail: tToast("streamFailed") });
    },
    [handleResetExecution, log, streamExecution, tToast]
  );

  // ---- Node toolbar actions --------------------------------------------------------
  const handleNodeAction = useCallback(
    (nodeId: string, action: NodeAction) => {
      if (action === "delete") handleDeleteNode(nodeId);
      else if (action === "duplicate") handleDuplicate(nodeId);
      else {
        setSelectedNodeId(nodeId);
        setInspectorTab("test");
      }
    },
    [handleDeleteNode, handleDuplicate]
  );

  const handleBack = useCallback(() => {
    if (isDirty) setLeaveOpen(true);
    else router.push("/");
  }, [isDirty, router]);

  // ---- Keyboard shortcuts ------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Preserved: Ctrl/⌘+S save, Ctrl/⌘+Enter test run (work everywhere).
      if (mod && key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        handleExecuteTest();
        return;
      }

      const dialogOpen = Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
      if (dialogOpen || isTypingTarget(e.target)) return;

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        history.redo();
      } else if (mod && key === "d") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDuplicate(selectedNodeId);
        }
      } else if (e.key === "Escape") {
        if (picker) setPicker(null);
        else setSelectedNodeId(null);
      } else if (!mod && !e.altKey) {
        if (key === "a") {
          e.preventDefault();
          openPicker({ kind: "add" });
        } else if (key === "f") {
          e.preventDefault();
          rf.fitView({ ...FIT_OPTIONS, duration: 400 });
        } else if (e.key === "?") {
          e.preventDefault();
          setShortcutsOpen(true);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleExecuteTest, history, handleDuplicate, selectedNodeId, picker, openPicker, rf]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const found = nodes.find((n) => n.id === selectedNodeId);
    return found ? (found as unknown as DAGNode) : null;
  }, [nodes, selectedNodeId]);

  const uiContext = useMemo(
    () => ({
      cycleNodeIds,
      hoveredEdgeId,
      readOnly: false,
      onNodeAction: handleNodeAction,
      onEdgeInsert: (edgeId: string, screen: { x: number; y: number }) => openPicker({ kind: "insert", edgeId }, screen),
      onEdgeDelete: handleEdgeDelete,
    }),
    [cycleNodeIds, hoveredEdgeId, handleNodeAction, openPicker, handleEdgeDelete]
  );

  // Keyboard users select nodes with Tab + Enter/Space; keep the inspector in sync with selection.
  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      if (selected.length === 1 && selected[0].id !== selectedNodeId) {
        setInspectorTab("configure");
        setSelectedNodeId(selected[0].id);
      }
    },
    [selectedNodeId]
  );

  const closeInspector = useCallback(() => {
    setSelectedNodeId(null);
    setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds));
  }, [setNodes]);

  return (
    <CanvasUIProvider value={uiContext}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-app text-fg">
        <WorkflowNavbar
          workflowName={workflowName}
          workflowStatus={workflowStatus}
          saveState={saveState}
          isSaving={isSaving}
          isPublishing={isPublishing}
          isExecuting={isExecuting}
          hasCycleError={dagValidation.hasCycle}
          session={session}
          modKey={modKey}
          onBack={handleBack}
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
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onToggleEnabled={isNew ? undefined : handleToggleEnabled}
          onDeleteWorkflow={isNew ? undefined : () => setDeleteOpen(true)}
        />

        <div className="relative flex min-h-0 flex-1">
          <NodePalette
            onAddNode={(type) => handleAddNode(type)}
            isCollapsed={isPaletteCollapsed}
            onToggleCollapse={() =>
              setIsPaletteCollapsed((c) => {
                writePref("nf-palette-collapsed", c ? "0" : "1");
                return !c;
              })
            }
          />

          <div className="relative flex min-w-0 flex-1 flex-col">
            <div
              ref={reactFlowWrapper}
              className="relative min-h-0 flex-1"
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).classList.contains("react-flow__pane")) {
                  openPicker({ kind: "add", flowPos: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) }, { x: e.clientX, y: e.clientY });
                }
              }}
            >
              <EdgeMarkers />
              <ReactFlow
                className="nf-flow"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                onBeforeDelete={async () => {
                  takeSnapshot();
                  return true;
                }}
                onNodeDragStart={() => takeSnapshot()}
                onNodeClick={(_, node) => {
                  if (node.id !== selectedNodeId) setInspectorTab("configure");
                  setSelectedNodeId(node.id);
                }}
                onPaneClick={() => setSelectedNodeId(null)}
                onSelectionChange={onSelectionChange}
                onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={FIT_OPTIONS}
                minZoom={0.2}
                maxZoom={2}
                zoomOnDoubleClick={false}
                deleteKeyCode={["Backspace", "Delete"]}
                proOptions={{ hideAttribution: true }}
                snapToGrid
                snapGrid={[16, 16]}
                defaultEdgeOptions={{ type: "workflowEdge" }}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} />
                {isDesktop && (
                  <MiniMap
                    position="bottom-right"
                    className="!hidden lg:!block"
                    pannable
                    zoomable
                    nodeBorderRadius={6}
                    nodeColor={(n) => NODE_META[asNodeType((n.data as unknown as NodeData)?.type)].color}
                    ariaLabel="Minimap"
                  />
                )}
              </ReactFlow>

              {nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-overlay/95 p-6 text-center shadow-elev-3 backdrop-blur animate-in fade-in-0 zoom-in-95 duration-300">
                    <h2 className="text-base font-semibold text-fg">{t("empty.title")}</h2>
                    <p className="mt-1.5 text-[13px] leading-5 text-fg-muted">{t("empty.body")}</p>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => handleAddNode("trigger")}>
                        <Play className="text-node-trigger" aria-hidden /> {tNodes("trigger.short")}
                      </Button>
                      <Button variant="secondary" onClick={() => handleAddNode("webhook")}>
                        <Webhook className="text-node-webhook" aria-hidden /> {tNodes("webhook.short")}
                      </Button>
                    </div>
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
                        <Layers className="size-3.5" aria-hidden /> {t("empty.browse")}
                      </p>
                      <div className="space-y-1.5">
                        {WORKFLOW_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleSelectTemplate(tpl.id)}
                            className="w-full truncate rounded-lg border border-line bg-surface px-3 py-2 text-left text-[13px] text-fg transition-colors hover:border-line-strong hover:bg-surface-2"
                          >
                            {tpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <MobileTip />

              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-4">
                <CanvasToolbar
                  onAddStep={() => openPicker({ kind: "add" })}
                  onUndo={history.undo}
                  onRedo={history.redo}
                  canUndo={history.canUndo}
                  canRedo={history.canRedo}
                  onAutoLayout={handleAutoLayout}
                  runPanelOpen={runPanelOpen}
                  onToggleRunPanel={() => setRunPanelOpen((o) => !o)}
                  modKey={modKey}
                />
              </div>
            </div>

            <RunPanel
              open={runPanelOpen}
              onOpenChange={setRunPanelOpen}
              nodes={nodes as unknown as DAGNode[]}
              edges={edges as unknown as DAGEdge[]}
              logs={logs}
              onClearLogs={() => setLogs([])}
              isExecuting={isExecuting}
            />
          </div>

          <NodeInspector
            selectedNode={selectedNode}
            allNodes={nodes as unknown as DAGNode[]}
            allEdges={edges as unknown as DAGEdge[]}
            credentialNames={credentialNames}
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={closeInspector}
            width={inspectorWidth}
            onWidthChange={(w) => {
              setInspectorWidth(w);
              writePref("nf-inspector-width", String(w));
            }}
          />
        </div>

        <NodePicker
          open={picker !== null}
          at={picker?.at ?? null}
          allowed={pickerAllowed}
          onSelect={handlePick}
          onClose={() => setPicker(null)}
        />

        <ExecutionHistoryModal
          workflowId={workflowId}
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onReplayExecution={handleReplayExecution}
        />

        <WebhookConsoleModal
          workflowId={workflowId}
          nodes={nodes as unknown as DAGNode[]}
          isOpen={isWebhookModalOpen}
          onClose={() => setIsWebhookModalOpen(false)}
          onStreamExecution={handleStreamExecutionById}
        />

        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} modKey={modKey} />

        <ConfirmDialog
          open={pendingReplace !== null}
          onOpenChange={(o) => !o && setPendingReplace(null)}
          title={pendingReplace?.kind === "import" ? t("confirm.importTitle") : t("confirm.templateTitle")}
          description={pendingReplace?.kind === "import" ? t("confirm.importBody") : t("confirm.templateBody")}
          confirmLabel={pendingReplace?.kind === "import" ? t("confirm.importConfirm") : t("confirm.templateConfirm")}
          onConfirm={() => {
            if (pendingReplace) applyReplace(pendingReplace);
            setPendingReplace(null);
          }}
        />

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          tone="danger"
          title={t("confirm.deleteTitle")}
          description={t("confirm.deleteBody", { name: workflowName })}
          confirmLabel={t("confirm.deleteConfirm")}
          confirmText={workflowName}
          onConfirm={handleDeleteWorkflow}
        />

        <ConfirmDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          tone="danger"
          title={t("confirm.leaveTitle")}
          description={t("confirm.leaveBody")}
          confirmLabel={t("confirm.leaveConfirm")}
          onConfirm={() => {
            setSavedSignature(signature);
            router.push("/");
          }}
        />
      </div>
    </CanvasUIProvider>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
