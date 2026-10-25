"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Trash2,
  Code,
  Variable,
  Sparkles,
  Check,
  Play,
  Terminal,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DAGNode, NodeData, WorkflowNodeType } from "@/lib/dag/types";
import {
  testSingleStepAction,
  StepTestResult,
} from "@/lib/actions/step-tester-actions";
import { toast } from "sonner";

interface NodeInspectorProps {
  selectedNode: DAGNode | null;
  allNodes: DAGNode[];
  onUpdateNode: (nodeId: string, updatedData: Partial<NodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeInspector({
  selectedNode,
  allNodes,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: NodeInspectorProps) {
  const t = useTranslations("workflow.inspector");
  const tNodes = useTranslations("nodes");
  const [copiedVar, setCopiedVar] = React.useState<string | null>(null);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<StepTestResult | null>(null);
  const [isSendingWebhook, setIsSendingWebhook] = React.useState(false);

  if (!selectedNode) {
    return null;
  }

  const { id } = selectedNode;
  const data = selectedNode.data;
  const nodeType = (data.type || "action") as WorkflowNodeType;
  const config = data.config || {};

  function handleConfigChange(key: string, value: unknown) {
    onUpdateNode(id, {
      config: {
        ...config,
        [key]: value,
      },
    });
  }

  function copyVariable(varString: string) {
    navigator.clipboard.writeText(varString);
    setCopiedVar(varString);
    toast.success(`Copied ${varString}`);
    setTimeout(() => setCopiedVar(null), 2000);
  }

  async function handleRunStepTest() {
    setIsTesting(true);
    try {
      const res = await testSingleStepAction(nodeType, config);
      setTestResult(res);
      if (res.success) {
        toast.success(`Step test completed (${res.durationMs}ms)`);
      } else {
        toast.error(res.error || "Step test failed");
      }
    } catch {
      toast.error("Execution error during step test.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleDispatchWebhookTest() {
    const slug = String(config.path || "customer-signup-hook");
    setIsSendingWebhook(true);
    try {
      const res = await fetch(`/api/workflows/wh/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cust_test_9921",
          email: "simulator@enterprise.io",
          tier: "enterprise",
          timestamp: Date.now(),
        }),
      });
      const json = await res.json();
      if (res.status === 202) {
        toast.success("Webhook event accepted (HTTP 202)!", {
          description: `Execution queued with ID: ${json.executionId}`,
        });
        setTestResult({
          success: true,
          statusCode: 202,
          durationMs: 4,
          data: json,
        });
      } else {
        toast.error(`Webhook returned HTTP ${res.status}`);
        setTestResult({
          success: false,
          statusCode: res.status,
          durationMs: 4,
          error: json.error || "Webhook test failed",
        });
      }
    } catch {
      toast.error("Failed to connect to webhook route.");
    } finally {
      setIsSendingWebhook(false);
    }
  }

  // Generate available upstream variables based on other nodes
  const upstreamNodes = allNodes.filter((n) => n.id !== id);

  return (
    <>
      {/* Mobile Backdrop Tap to Dismiss */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[84vh] h-[84vh] rounded-t-2xl border-t border-zinc-800 bg-zinc-950/98 shadow-2xl flex flex-col backdrop-blur-md transition-all duration-300 md:inset-y-0 md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[380px] lg:w-[420px] md:rounded-none md:border-l md:border-t-0 animate-in slide-in-from-bottom-6 md:slide-in-from-right-6">
        {/* Mobile Grab Handle */}
        <div
          className="flex justify-center pt-2.5 pb-1 md:hidden cursor-pointer"
          onClick={onClose}
        >
          <div className="h-1.5 w-12 rounded-full bg-zinc-700/80 hover:bg-zinc-600 transition-colors" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              {t("title")}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              {id}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteNode(id)}
            className="text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20"
            title={t("deleteNode")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label & Description */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-zinc-300 block mb-1">
              {t("label")}
            </label>
            <Input
              value={data.label || ""}
              onChange={(e) => onUpdateNode(id, { label: e.target.value })}
              placeholder="e.g. Fetch Customer Records"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-300 block mb-1">
              {t("description")}
            </label>
            <Input
              value={data.description || ""}
              onChange={(e) => onUpdateNode(id, { description: e.target.value })}
              placeholder="Brief description of this operation"
            />
          </div>
        </div>

        {/* Node Type Specific Configurations */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-3">
          <div className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Code className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t("configuration")}</span>
          </div>

          {/* Trigger Node Form */}
          {nodeType === "trigger" && (
            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                {tNodes("trigger.fields.payload")}
              </label>
              <Textarea
                rows={5}
                value={
                  typeof config.payload === "string"
                    ? config.payload
                    : JSON.stringify(config.payload ?? { event: "manual_test", timestamp: Date.now() }, null, 2)
                }
                onChange={(e) => handleConfigChange("payload", e.target.value)}
                placeholder='{\n  "userId": "usr_123",\n  "status": "active"\n}'
              />
            </div>
          )}

          {/* Webhook Node Form */}
          {nodeType === "webhook" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("webhook.fields.path")}
                </label>
                <div className="flex items-center">
                  <span className="text-[11px] text-zinc-500 bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-md px-2.5 py-1.5">
                    /api/workflows/wh/
                  </span>
                  <Input
                    className="rounded-l-none"
                    value={String(config.path || "")}
                    onChange={(e) => handleConfigChange("path", e.target.value)}
                    placeholder={tNodes("webhook.fields.pathPlaceholder")}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("webhook.fields.authHeader")}
                </label>
                <Input
                  value={String(config.secretHeader || "")}
                  onChange={(e) => handleConfigChange("secretHeader", e.target.value)}
                  placeholder="X-Webhook-Secret-Key"
                />
              </div>
            </div>
          )}

          {/* Action Node Form */}
          {nodeType === "action" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("action.fields.method")}
                </label>
                <select
                  value={String(config.method || "POST")}
                  onChange={(e) => handleConfigChange("method", e.target.value)}
                  className="w-full h-8 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("action.fields.url")}
                </label>
                <Input
                  value={String(config.url || "")}
                  onChange={(e) => handleConfigChange("url", e.target.value)}
                  placeholder={tNodes("action.fields.urlPlaceholder")}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("action.fields.headers")}
                </label>
                <Textarea
                  rows={3}
                  value={
                    typeof config.headers === "string"
                      ? config.headers
                      : JSON.stringify(config.headers ?? { "Content-Type": "application/json" }, null, 2)
                  }
                  onChange={(e) => handleConfigChange("headers", e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("action.fields.body")}
                </label>
                <Textarea
                  rows={4}
                  value={
                    typeof config.body === "string"
                      ? config.body
                      : JSON.stringify(
                          config.body ?? {
                            id: "{{trigger.body.id}}",
                            action: "process",
                          },
                          null,
                          2
                        )
                  }
                  onChange={(e) => handleConfigChange("body", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Filter Node Form */}
          {nodeType === "filter" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("filter.fields.field")}
                </label>
                <Input
                  value={String(config.field || "")}
                  onChange={(e) => handleConfigChange("field", e.target.value)}
                  placeholder={tNodes("filter.fields.fieldPlaceholder")}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("filter.fields.operator")}
                </label>
                <select
                  value={String(config.operator || "equals")}
                  onChange={(e) => handleConfigChange("operator", e.target.value)}
                  className="w-full h-8 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="equals">{tNodes("filter.fields.operators.equals")}</option>
                  <option value="notEquals">{tNodes("filter.fields.operators.notEquals")}</option>
                  <option value="contains">{tNodes("filter.fields.operators.contains")}</option>
                  <option value="greaterThan">{tNodes("filter.fields.operators.greaterThan")}</option>
                  <option value="lessThan">{tNodes("filter.fields.operators.lessThan")}</option>
                  <option value="exists">{tNodes("filter.fields.operators.exists")}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  {tNodes("filter.fields.value")}
                </label>
                <Input
                  value={String(config.value ?? "")}
                  onChange={(e) => handleConfigChange("value", e.target.value)}
                  placeholder="Expected value to match"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step Isolation Runner & Webhook Simulator */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">
              <Terminal className="h-3.5 w-3.5 text-amber-400" />
              <span>Step Execution Sandbox</span>
            </div>
            {testResult && (
              <Badge
                variant={testResult.success ? "default" : "failed"}
                className="text-[10px] px-1.5 py-0"
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1 inline" />
                )}
                {testResult.durationMs}ms
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 leading-normal">
            Execute this single node in isolation with sample payload to test logic before orchestrating the full DAG.
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isTesting}
              onClick={handleRunStepTest}
              className="flex-1 h-8 text-xs font-medium border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Testing Step...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Test Step Output
                </>
              )}
            </Button>

            {nodeType === "webhook" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSendingWebhook}
                onClick={handleDispatchWebhookTest}
                className="h-8 text-xs font-medium border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300"
                title="Send sample HTTP POST to Webhook route"
              >
                {isSendingWebhook ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Ping Webhook
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Test Result Output Display */}
          {testResult && (
            <div className="mt-2 rounded-md bg-zinc-900/90 border border-zinc-800 p-2.5 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="font-semibold text-zinc-300">Sandbox Response:</span>
                <span>Status: {testResult.statusCode ?? (testResult.success ? 200 : 500)}</span>
              </div>
              {testResult.error ? (
                <div className="text-rose-400 text-[11px] break-all bg-rose-950/30 p-2 rounded border border-rose-900/50">
                  {testResult.error}
                </div>
              ) : (
                <pre className="max-h-40 overflow-y-auto text-[10.5px] text-emerald-400 bg-zinc-950/60 p-2 rounded border border-zinc-800/80 leading-tight">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Variable Interpolation Helper */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">
            <Variable className="h-3.5 w-3.5 text-violet-400" />
            <span>{t("variables")}</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-normal">
            {t("variableHint")}
          </p>

          <div className="space-y-1.5 pt-1">
            <div
              onClick={() => copyVariable("{{trigger.body.id}}")}
              className="group flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs"
            >
              <span className="font-mono text-[11px] text-violet-400">
                {"{{trigger.body.id}}"}
              </span>
              {copiedVar === "{{trigger.body.id}}" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
            </div>

            {upstreamNodes.map((node) => {
              const varKey = `{{steps.${node.id}.output.data}}`;
              return (
                <div
                  key={node.id}
                  onClick={() => copyVariable(varKey)}
                  className="group flex items-center justify-between p-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs"
                >
                  <div className="truncate mr-2">
                    <span className="font-mono text-[11px] text-sky-400">
                      {varKey}
                    </span>
                    <div className="text-[10px] text-zinc-500 truncate">
                      From: {node.data.label || node.id}
                    </div>
                  </div>
                  {copiedVar === varKey ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                  )}
                </div>
              );
            })}

            {/* Hardware Vault Credentials */}
            <div className="pt-2 border-t border-zinc-800/60">
              <div className="text-[10px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Vault Secrets (AES-256-GCM)</span>
              </div>
              <div
                onClick={() => copyVariable("{{credentials.STRIPE_PRODUCTION_API_KEY}}")}
                className="group flex items-center justify-between p-2 rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs mb-1"
              >
                <span className="font-mono text-[10px] text-emerald-400 truncate">
                  {"{{credentials.STRIPE_PRODUCTION_API_KEY}}"}
                </span>
                {copiedVar === "{{credentials.STRIPE_PRODUCTION_API_KEY}}" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                )}
              </div>
              <div
                onClick={() => copyVariable("{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}")}
                className="group flex items-center justify-between p-2 rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs"
              >
                <span className="font-mono text-[10px] text-emerald-400 truncate">
                  {"{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}"}
                </span>
                {copiedVar === "{{credentials.INTERNAL_LEDGER_AUTH_SECRET}}" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
