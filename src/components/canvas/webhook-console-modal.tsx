"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Send,
  Radio,
  Check,
  Copy,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DAGNode, NodeData } from "@/lib/dag/types";
import { toast } from "sonner";

interface WebhookConsoleModalProps {
  workflowId: string;
  nodes: DAGNode[];
  isOpen: boolean;
  onClose: () => void;
  onStreamExecution?: (executionId: string) => void;
}

interface WebhookResponse {
  status: number;
  durationMs: number;
  body: Record<string, unknown> | null;
  error?: string;
}

const SAMPLE_PRESETS: Record<
  string,
  { label: string; defaultPath: string; payload: Record<string, unknown> }
> = {
  stripe_charge: {
    label: "Stripe: charge.succeeded",
    defaultPath: "stripe-charge-hook",
    payload: {
      id: "ch_3NabcXYZcorp2026",
      amount: 25000,
      currency: "usd",
      customerId: "cus_live_enterprise_992",
      riskLevel: "low",
      status: "succeeded",
    },
  },
  customer_signup: {
    label: "Customer Ingestion (KYC)",
    defaultPath: "customer-signup-hook",
    payload: {
      customerId: "cust_9824",
      email: "jane.doe@enterprise.io",
      tier: "enterprise",
      organization: "Global Finance Corp",
      credits: 50000,
    },
  },
  github_push: {
    label: "GitHub: push.event",
    defaultPath: "github-webhook",
    payload: {
      repository: "enterprise-dag-platform",
      branch: "main",
      commitsCount: 3,
      author: "Principal Architect",
      deployed: true,
    },
  },
};

export function WebhookConsoleModal({
  nodes,
  isOpen,
  onClose,
  onStreamExecution,
}: WebhookConsoleModalProps) {
  const t = useTranslations("webhookConsole");

  // Detect webhook paths from nodes on canvas
  const webhookNodes = nodes.filter((n) => (n.data as NodeData).type === "webhook");
  const defaultPath =
    webhookNodes.length > 0
      ? String((webhookNodes[0].data as NodeData).config?.path || "stripe-charge-hook")
      : "stripe-charge-hook";

  const [path, setPath] = useState(defaultPath);
  const [authHeader, setAuthHeader] = useState("whsec_corp_ledger_key_2026");
  const [selectedPreset, setSelectedPreset] = useState("stripe_charge");
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(SAMPLE_PRESETS.stripe_charge.payload, null, 2)
  );
  const [isSending, setIsSending] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [lastResponse, setLastResponse] = useState<WebhookResponse | null>(null);

  if (!isOpen) return null;

  const fullUrl = `/api/workflows/wh/${path}`;

  function handlePresetChange(key: string) {
    setSelectedPreset(key);
    const preset = SAMPLE_PRESETS[key];
    if (preset) {
      setPath(preset.defaultPath);
      setPayloadText(JSON.stringify(preset.payload, null, 2));
    }
  }

  function copyUrlToClipboard() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}${fullUrl}`);
    setCopiedUrl(true);
    toast.success("Webhook endpoint URL copied!");
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  async function handleDispatchWebhook() {
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(payloadText);
    } catch {
      toast.error(t("invalidJson"));
      return;
    }

    setIsSending(true);
    setLastResponse(null);
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeader.trim()) {
        headers["X-Webhook-Secret-Key"] = authHeader.trim();
      }

      const res = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(parsedBody),
      });

      const durationMs = Math.round(performance.now() - startTime);
      const json = await res.json();

      setLastResponse({
        status: res.status,
        durationMs,
        body: json,
      });

      if (res.status === 202) {
        toast.success(`HTTP 202 Accepted! Queued in ${durationMs}ms`, {
          description: `Execution ID: ${json.executionId}`,
        });
      } else {
        toast.error(`Webhook returned HTTP ${res.status}`);
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      setLastResponse({
        status: 500,
        durationMs,
        body: null,
        error: err instanceof Error ? err.message : "Failed to dispatch request",
      });
      toast.error("Network error dispatching webhook request.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col h-[85vh] w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>{t("title")}</span>
                <Badge variant="neutral" className="text-[10px] uppercase font-mono">
                  HTTP 202 Async
                </Badge>
              </h2>
              <p className="text-[11px] text-zinc-400">{t("subtitle")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Endpoint URL bar */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-300 block">
              {t("targetEndpoint")}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
              <div className="flex items-center flex-1">
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-md px-2.5 sm:px-3 py-2 shrink-0">
                  POST /api/workflows/wh/
                </span>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="webhook-slug"
                  className="rounded-none rounded-r-md sm:rounded-r-none font-mono text-xs border-r sm:border-r-0"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={copyUrlToClipboard}
                className="mt-2 sm:mt-0 rounded-md sm:rounded-l-none border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 shrink-0 gap-1.5"
                title={t("copyUrl")}
              >
                {copiedUrl ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="text-xs">Copy URL</span>
              </Button>
            </div>
          </div>

          {/* Preset & Auth Header Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1.5">
                {t("preset")}
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {Object.entries(SAMPLE_PRESETS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1.5">
                {t("headers")} (X-Webhook-Secret-Key)
              </label>
              <Input
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="whsec_secret_key"
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Payload Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-300">
                {t("payload")}
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Content-Type: application/json
              </span>
            </div>
            <Textarea
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="font-mono text-xs bg-zinc-950/80 border-zinc-800 text-zinc-100 leading-relaxed resize-none"
            />
          </div>

          {/* Dispatch Action Button */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              onClick={handleDispatchWebhook}
              disabled={isSending || !path.trim()}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs gap-2 px-5 py-2.5 shadow-lg shadow-violet-950/50"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("dispatching")}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{t("dispatch")}</span>
                </>
              )}
            </Button>
          </div>

          {/* Response Telemetry Inspector */}
          {lastResponse && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">
                    {t("responseStatus")}:
                  </span>
                  <Badge
                    variant={lastResponse.status === 202 ? "default" : "failed"}
                    className="font-mono text-xs"
                  >
                    {lastResponse.status === 202 ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1 inline" />
                    )}
                    HTTP {lastResponse.status}
                  </Badge>
                  <span className="text-xs text-zinc-500 font-mono">
                    {lastResponse.durationMs}ms
                  </span>
                </div>

                {/* Direct Watch Stream Button */}
                {Boolean(lastResponse.body?.executionId) && onStreamExecution ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onStreamExecution(String(lastResponse.body?.executionId));
                      onClose();
                    }}
                    className="border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-xs gap-1.5 h-8"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{t("streamOnCanvas")}</span>
                  </Button>
                ) : null}
              </div>

              {lastResponse.error ? (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-xs text-rose-300 font-mono">
                  {lastResponse.error}
                </div>
              ) : (
                <pre className="max-h-48 overflow-y-auto rounded-lg bg-zinc-950 p-3 text-[11px] font-mono text-emerald-400 border border-zinc-800/80 leading-relaxed">
                  {JSON.stringify(lastResponse.body, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
