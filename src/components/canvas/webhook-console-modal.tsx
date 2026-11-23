"use client";

import React, { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Play, Radio, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/patterns/copy-button";
import { JsonView } from "@/components/patterns/json-view";
import type { DAGNode, NodeData } from "@/lib/dag/types";
import { formatDuration } from "@/lib/utils";

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

const SAMPLE_PRESETS: Record<string, { label: string; defaultPath: string; payload: Record<string, unknown> }> = {
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

export function WebhookConsoleModal({ nodes, isOpen, onClose, onStreamExecution }: WebhookConsoleModalProps) {
  const t = useTranslations("webhookConsole");
  const tUi = useTranslations("ui");
  const ids = { path: useId(), preset: useId(), secret: useId(), payload: useId() };

  const webhookNodes = nodes.filter((n) => (n.data as NodeData).type === "webhook");
  const defaultPath =
    webhookNodes.length > 0
      ? String((webhookNodes[0].data as NodeData).config?.path || "stripe-charge-hook")
      : "stripe-charge-hook";

  const [path, setPath] = useState(defaultPath);
  const [authHeader, setAuthHeader] = useState("whsec_corp_ledger_key_2026");
  const [selectedPreset, setSelectedPreset] = useState("stripe_charge");
  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_PRESETS.stripe_charge.payload, null, 2));
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<WebhookResponse | null>(null);

  const fullUrl = `/api/workflows/wh/${path}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const payloadInvalid = React.useMemo(() => {
    try {
      JSON.parse(payloadText);
      return false;
    } catch {
      return true;
    }
  }, [payloadText]);

  function handlePresetChange(key: string) {
    setSelectedPreset(key);
    const preset = SAMPLE_PRESETS[key];
    if (preset) {
      setPath(preset.defaultPath);
      setPayloadText(JSON.stringify(preset.payload, null, 2));
    }
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authHeader.trim()) headers["X-Webhook-Secret-Key"] = authHeader.trim();

      const res = await fetch(fullUrl, { method: "POST", headers, body: JSON.stringify(parsedBody) });
      const durationMs = Math.round(performance.now() - startTime);
      const json = await res.json();
      setLastResponse({ status: res.status, durationMs, body: json });

      if (res.status === 202) {
        toast.success(t("accepted", { ms: durationMs }), { description: t("executionId", { id: json.executionId }) });
      } else {
        toast.error(t("returned", { status: res.status }));
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      setLastResponse({
        status: 500,
        durationMs,
        body: null,
        error: err instanceof Error ? err.message : "Failed to dispatch request",
      });
      toast.error(t("networkError"));
    } finally {
      setIsSending(false);
    }
  }

  const ok = lastResponse?.status === 202;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" closeLabel={tUi("close")} className="h-[min(88dvh,760px)]">
        <DialogHeader className="flex-row items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-node-webhook/15 text-node-webhook">
            <Radio className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {t("title")}
              <Badge variant="neutral" className="font-mono">
                {t("async")}
              </Badge>
            </DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <Field
            id={ids.path}
            label={t("targetEndpoint")}
            action={<CopyButton value={`${origin}${fullUrl}`} label={t("copyUrl")} toastMessage={t("copied")} />}
          >
            <div className="flex">
              <span className="flex shrink-0 items-center rounded-l-lg border border-r-0 border-line bg-surface-2 px-2.5 font-mono text-xs text-fg-subtle">
                <span className="mr-1.5 rounded bg-success/15 px-1 font-semibold text-fg">POST</span>/api/workflows/wh/
              </span>
              <Input
                id={ids.path}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="webhook-slug"
                className="rounded-l-none font-mono"
                spellCheck={false}
              />
            </div>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field id={ids.preset} label={t("preset")}>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger id={ids.preset}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SAMPLE_PRESETS).map(([key, item]) => (
                    <SelectItem key={key} value={key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id={ids.secret} label={`${t("secretHeader")} · X-Webhook-Secret-Key`}>
              <Input
                id={ids.secret}
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="whsec_secret_key"
                className="font-mono"
                spellCheck={false}
              />
            </Field>
          </div>

          <Field
            id={ids.payload}
            label={t("payload")}
            error={payloadInvalid ? t("invalidJson") : undefined}
            action={<span className="font-mono text-2xs text-fg-subtle">Content-Type: application/json</span>}
          >
            <Textarea
              id={ids.payload}
              rows={9}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              spellCheck={false}
              aria-invalid={payloadInvalid || undefined}
              className="resize-none font-mono text-[13px] leading-relaxed sm:text-xs"
            />
          </Field>

          <Button onClick={handleDispatchWebhook} disabled={!path.trim() || payloadInvalid} loading={isSending} className="w-full sm:w-auto">
            {!isSending && <Send aria-hidden />}
            {isSending ? t("dispatching") : t("dispatch")}
          </Button>

          {lastResponse && (
            <section className="space-y-3 rounded-xl border border-line bg-surface p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium text-fg">{t("responseStatus")}</span>
                  <Badge variant={ok ? "success" : "failed"} dot={false} className="font-mono">
                    {ok ? (
                      <CheckCircle2 className="size-3 text-success" aria-hidden />
                    ) : (
                      <XCircle className="size-3 text-failed" aria-hidden />
                    )}
                    HTTP {lastResponse.status}
                  </Badge>
                  <span className="font-mono text-xs tabular-nums text-fg-subtle">{formatDuration(lastResponse.durationMs)}</span>
                </div>
                {Boolean(lastResponse.body?.executionId) && onStreamExecution ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onStreamExecution(String(lastResponse.body?.executionId));
                      onClose();
                    }}
                  >
                    <Play className="fill-current text-running" aria-hidden /> {t("streamOnCanvas")}
                  </Button>
                ) : null}
              </div>
              {lastResponse.error ? (
                <p className="rounded-lg border border-failed/30 bg-failed/10 p-3 font-mono text-xs text-fg">{lastResponse.error}</p>
              ) : (
                <JsonView value={lastResponse.body} maxHeight="max-h-52" />
              )}
            </section>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
