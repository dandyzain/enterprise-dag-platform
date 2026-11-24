"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Braces, CheckCircle2, FlaskConical, Send, Settings2, Trash2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { CopyButton, CopyIcon, useCopy } from "@/components/patterns/copy-button";
import { JsonView } from "@/components/patterns/json-view";
import { StatusIcon } from "@/components/patterns/status-badge";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import type { DAGEdge, DAGNode, NodeData } from "@/lib/dag/types";
import { testSingleStepAction, type StepTestResult } from "@/lib/actions/step-tester-actions";
import { getAncestorIds, objectKeyPaths } from "@/lib/ui/graph";
import { cn, formatDuration } from "@/lib/utils";
import { CodeField, type VariableSuggestion } from "./code-field";
import { NODE_META, asNodeType } from "./node-meta";

export type InspectorTab = "configure" | "test" | "variables";

interface NodeInspectorProps {
  selectedNode: DAGNode | null;
  allNodes: DAGNode[];
  allEdges: DAGEdge[];
  credentialNames: string[];
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdateNode: (nodeId: string, updatedData: Partial<NodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

const MIN_W = 320;
const MAX_W = 580;

export function NodeInspector(props: NodeInspectorProps) {
  const { selectedNode, onClose, width, onWidthChange } = props;
  const t = useTranslations("editor.inspector");
  const isDesktop = useMediaQuery(BREAKPOINTS.md, true);

  if (!selectedNode) return null;

  if (!isDesktop) {
    return (
      <Drawer open onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="h-[86dvh]">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          <InspectorBody key={selectedNode.id} {...props} selectedNode={selectedNode} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside
      aria-label={t("title")}
      className="absolute inset-y-0 right-0 z-20 flex border-l border-line bg-overlay shadow-elev-3 animate-in fade-in-0 slide-in-from-right-4 duration-200 lg:static lg:shadow-none"
      style={{ width }}
    >
      <ResizeHandle width={width} onWidthChange={onWidthChange} label={t("resize")} />
      <div className="flex min-w-0 flex-1 flex-col">
        <InspectorBody key={selectedNode.id} {...props} selectedNode={selectedNode} />
      </div>
    </aside>
  );
}

function ResizeHandle({ width, onWidthChange, label }: { width: number; onWidthChange: (w: number) => void; label: string }) {
  const start = React.useRef<{ x: number; w: number } | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_W}
      aria-valuemax={MAX_W}
      aria-valuenow={width}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onWidthChange(Math.min(MAX_W, width + 24));
        if (e.key === "ArrowRight") onWidthChange(Math.max(MIN_W, width - 24));
      }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, w: width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const next = start.current.w + (start.current.x - e.clientX);
        onWidthChange(Math.max(MIN_W, Math.min(MAX_W, next)));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize outline-none lg:block"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-medium text-fg-subtle">{children}</h3>;
}

function InspectorBody({
  selectedNode,
  allNodes,
  allEdges,
  credentialNames,
  tab,
  onTabChange,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: NodeInspectorProps & { selectedNode: DAGNode }) {
  const t = useTranslations("editor.inspector");
  const tNodes = useTranslations("nodes");
  const tStatus = useTranslations("status");
  const tWebhook = useTranslations("webhookConsole");
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<StepTestResult | null>(null);
  const [isSendingWebhook, setIsSendingWebhook] = React.useState(false);
  const fid = React.useId();

  const { id } = selectedNode;
  const data = selectedNode.data;
  const nodeType = asNodeType(data.type);
  const meta = NODE_META[nodeType];
  const Icon = meta.icon;
  const config = data.config || {};

  function handleConfigChange(key: string, value: unknown) {
    onUpdateNode(id, { config: { ...config, [key]: value } });
  }

  // ---- Variable references (real graph data) ----------------------------
  const ancestors = React.useMemo(() => getAncestorIds(id, allEdges), [id, allEdges]);
  const triggerRefs = React.useMemo(() => {
    const keys = new Set<string>();
    for (const n of allNodes) {
      if (n.data.type === "trigger") objectKeyPaths(n.data.config?.payload).forEach((k) => keys.add(k));
    }
    const refs = Array.from(keys).map((k) => `{{trigger.body.${k}}}`);
    return refs.length ? refs : ["{{trigger.body.id}}"];
  }, [allNodes]);
  const upstream = React.useMemo(
    () => allNodes.filter((n) => ancestors.includes(n.id)).map((n) => ({ ref: `{{steps.${n.id}.output.data}}`, label: n.data.label || n.id })),
    [allNodes, ancestors]
  );
  const vaultRefs = credentialNames.map((name) => `{{credentials.${name}}}`);

  const suggestions: VariableSuggestion[] = React.useMemo(
    () => [
      ...triggerRefs.map((label) => ({ label, detail: t("triggerVars") })),
      ...upstream.map((u) => ({ label: u.ref, detail: u.label })),
      ...vaultRefs.map((label) => ({ label, detail: t("vaultVars") })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerRefs, upstream, credentialNames]
  );

  // ---- Sandbox (unchanged behaviour) -----------------------------------
  async function handleRunStepTest() {
    setIsTesting(true);
    try {
      const res = await testSingleStepAction(nodeType, config);
      setTestResult(res);
      if (res.success) toast.success(t("stepTestDone", { ms: res.durationMs }));
      else toast.error(res.error || t("stepTestFailed"));
    } catch {
      toast.error(t("stepTestFailed"));
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
      const body = await res.json();
      if (res.status === 202) {
        toast.success(t("webhookAccepted"), { description: body.executionId });
        setTestResult({ success: true, statusCode: 202, durationMs: 4, data: body });
      } else {
        toast.error(t("webhookReturned", { status: res.status }));
        setTestResult({ success: false, statusCode: res.status, durationMs: 4, error: body.error || t("stepTestFailed") });
      }
    } catch {
      toast.error(t("webhookUnreachable"));
    } finally {
      setIsSendingWebhook(false);
    }
  }

  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/workflows/wh/${String(config.path || "")}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-fg">{data.label || tNodes(`${nodeType}.short`)}</h2>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <Badge variant={meta.badge}>{tNodes(`${nodeType}.short`)}</Badge>
            <span className="inline-flex min-w-0 items-center gap-0.5 rounded-md bg-surface-2 py-0.5 pl-1.5 pr-0.5 font-mono text-2xs text-fg-subtle">
              <span className="truncate">{id}</span>
              <CopyButton value={id} className="size-5" />
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip content={t("deleteStep")}>
            <Button variant="danger-ghost" size="icon-sm" onClick={() => onDeleteNode(id)} aria-label={t("deleteStep")}>
              <Trash2 aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip content={t("close")} shortcut="Esc">
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("close")}>
              <X aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as InspectorTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-2">
          <TabsTrigger value="configure">
            <Settings2 aria-hidden /> {t("tabs.configure")}
          </TabsTrigger>
          <TabsTrigger value="test">
            <FlaskConical aria-hidden /> {t("tabs.test")}
            {data.executionState && <StatusIcon status={data.executionState} className="size-3.5" />}
          </TabsTrigger>
          <TabsTrigger value="variables">
            <Braces aria-hidden /> {t("tabs.variables")}
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Configure */}
          <TabsContent value="configure" className="space-y-5 p-4">
            <div className="space-y-3">
              <Field id={`${fid}-label`} label={t("label")}>
                <Input
                  id={`${fid}-label`}
                  value={data.label || ""}
                  onChange={(e) => onUpdateNode(id, { label: e.target.value })}
                  placeholder={tNodes(`${nodeType}.defaultLabel`)}
                />
              </Field>
              <Field id={`${fid}-desc`} label={t("description")}>
                <Textarea
                  id={`${fid}-desc`}
                  rows={2}
                  value={data.description || ""}
                  onChange={(e) => onUpdateNode(id, { description: e.target.value })}
                  className="min-h-16 resize-none"
                />
              </Field>
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <SectionTitle>{t("parameters")}</SectionTitle>

              {nodeType === "trigger" && (
                <Field id={`${fid}-payload`} label={tNodes("trigger.fields.payload")}>
                  <CodeField
                    id={`${fid}-payload`}
                    value={config.payload ?? { event: "manual_test", timestamp: Date.now() }}
                    onChange={(v) => handleConfigChange("payload", v)}
                    variables={suggestions}
                    minHeight="140px"
                    ariaLabel={tNodes("trigger.fields.payload")}
                  />
                </Field>
              )}

              {nodeType === "webhook" && (
                <>
                  <Field
                    id={`${fid}-path`}
                    label={tNodes("webhook.fields.path")}
                    action={webhookUrl ? <CopyButton value={webhookUrl} label={tWebhook("copyUrl")} /> : null}
                  >
                    <div className="flex">
                      <span className="flex shrink-0 items-center rounded-l-lg border border-r-0 border-line bg-surface-2 px-2.5 font-mono text-xs text-fg-subtle">
                        /api/workflows/wh/
                      </span>
                      <Input
                        id={`${fid}-path`}
                        className="rounded-l-none font-mono"
                        value={String(config.path || "")}
                        onChange={(e) => handleConfigChange("path", e.target.value)}
                        placeholder={tNodes("webhook.fields.pathPlaceholder")}
                      />
                    </div>
                  </Field>
                  <Field id={`${fid}-secret`} label={tNodes("webhook.fields.authHeader")} hint={tNodes("webhook.fields.authHeaderHint")}>
                    <Input
                      id={`${fid}-secret`}
                      type="password"
                      autoComplete="off"
                      className="font-mono"
                      value={String(config.secretHeader || "")}
                      onChange={(e) => handleConfigChange("secretHeader", e.target.value)}
                      placeholder={tNodes("webhook.fields.authHeaderPlaceholder")}
                    />
                  </Field>
                  <Field id={`${fid}-sigp`} label={tNodes("webhook.fields.signatureProvider")}>
                    <Select
                      value={String(config.signatureProvider || "none")}
                      onValueChange={(v) => handleConfigChange("signatureProvider", v)}
                    >
                      <SelectTrigger id={`${fid}-sigp`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["none", "stripe", "github", "hmac"] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {tNodes(`webhook.fields.providers.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {String(config.signatureProvider || "none") !== "none" && (
                    <Field
                      id={`${fid}-sigc`}
                      label={tNodes("webhook.fields.signingSecretCredential")}
                      hint={tNodes("webhook.fields.signingSecretHint")}
                    >
                      <Input
                        id={`${fid}-sigc`}
                        className="font-mono"
                        value={String(config.signingSecretCredential || "")}
                        onChange={(e) => handleConfigChange("signingSecretCredential", e.target.value.toUpperCase())}
                        placeholder="STRIPE_WEBHOOK_SECRET"
                        spellCheck={false}
                      />
                    </Field>
                  )}
                </>
              )}

              {nodeType === "schedule" && (
                <>
                  <Field id={`${fid}-cron`} label={tNodes("schedule.fields.cron")} hint={tNodes("schedule.fields.cronHint")}>
                    <Input
                      id={`${fid}-cron`}
                      className="font-mono"
                      value={String(config.cron || "")}
                      onChange={(e) => handleConfigChange("cron", e.target.value)}
                      placeholder="0 9 * * 1-5"
                      spellCheck={false}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["*/15 * * * *", "every15"],
                      ["0 * * * *", "hourly"],
                      ["0 9 * * 1-5", "weekdays"],
                      ["0 0 * * *", "daily"],
                    ] as const).map(([expr, key]) => (
                      <Button key={expr} type="button" size="xs" variant="secondary" onClick={() => handleConfigChange("cron", expr)}>
                        {tNodes(`schedule.presets.${key}`)}
                      </Button>
                    ))}
                  </div>
                  <Field id={`${fid}-spayload`} label={tNodes("schedule.fields.payload")}>
                    <CodeField
                      id={`${fid}-spayload`}
                      value={config.payload ?? {}}
                      onChange={(v) => handleConfigChange("payload", v)}
                      variables={suggestions}
                      minHeight="72px"
                      ariaLabel={tNodes("schedule.fields.payload")}
                    />
                  </Field>
                </>
              )}

              {nodeType === "transform" && (
                <Field id={`${fid}-template`} label={tNodes("transform.fields.template")} hint={tNodes("transform.fields.templateHint")}>
                  <CodeField
                    id={`${fid}-template`}
                    value={config.template ?? {}}
                    onChange={(v) => handleConfigChange("template", v)}
                    variables={suggestions}
                    minHeight="140px"
                    ariaLabel={tNodes("transform.fields.template")}
                  />
                </Field>
              )}

              {nodeType === "delay" && (
                <Field id={`${fid}-delay`} label={tNodes("delay.fields.durationMs")} hint={tNodes("delay.fields.durationHint")}>
                  <Input
                    id={`${fid}-delay`}
                    type="number"
                    min={0}
                    max={30000}
                    step={500}
                    className="font-mono"
                    value={String(config.durationMs ?? 1000)}
                    onChange={(e) => handleConfigChange("durationMs", Math.max(0, Math.min(30000, Number(e.target.value) || 0)))}
                  />
                </Field>
              )}

              {nodeType === "action" && (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-medium text-fg">{tNodes("action.fields.method")}</span>
                    <div className="scrollbar-none overflow-x-auto">
                      <Segmented
                        size="sm"
                        ariaLabel={tNodes("action.fields.method")}
                        value={String(config.method || "POST") as (typeof methods)[number]}
                        onChange={(m) => handleConfigChange("method", m)}
                        options={methods.map((m) => ({ value: m, label: <span className="font-mono">{m}</span>, ariaLabel: m }))}
                      />
                    </div>
                  </div>
                  <Field id={`${fid}-url`} label={tNodes("action.fields.url")}>
                    <Input
                      id={`${fid}-url`}
                      className="font-mono"
                      value={String(config.url || "")}
                      onChange={(e) => handleConfigChange("url", e.target.value)}
                      placeholder={tNodes("action.fields.urlPlaceholder")}
                      spellCheck={false}
                    />
                  </Field>
                  <Field id={`${fid}-headers`} label={tNodes("action.fields.headers")}>
                    <CodeField
                      id={`${fid}-headers`}
                      value={config.headers ?? { "Content-Type": "application/json" }}
                      onChange={(v) => handleConfigChange("headers", v)}
                      variables={suggestions}
                      minHeight="72px"
                      ariaLabel={tNodes("action.fields.headers")}
                    />
                  </Field>
                  <label className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-fg">{tNodes("action.fields.failOnHttpError")}</span>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={config.failOnHttpError !== false}
                      onChange={(e) => handleConfigChange("failOnHttpError", e.target.checked)}
                    />
                  </label>
                  <Field id={`${fid}-body`} label={tNodes("action.fields.body")}>
                    <CodeField
                      id={`${fid}-body`}
                      value={config.body ?? { id: "{{trigger.body.id}}", action: "process" }}
                      onChange={(v) => handleConfigChange("body", v)}
                      variables={suggestions}
                      minHeight="110px"
                      ariaLabel={tNodes("action.fields.body")}
                    />
                  </Field>
                </>
              )}

              {nodeType === "filter" && (
                <>
                  <Field id={`${fid}-field`} label={tNodes("filter.fields.field")}>
                    <Input
                      id={`${fid}-field`}
                      className="font-mono"
                      value={String(config.field || "")}
                      onChange={(e) => handleConfigChange("field", e.target.value)}
                      placeholder={tNodes("filter.fields.fieldPlaceholder")}
                      spellCheck={false}
                      list={`${fid}-vars`}
                    />
                    <datalist id={`${fid}-vars`}>
                      {suggestions.map((s) => (
                        <option key={s.label} value={s.label} />
                      ))}
                    </datalist>
                  </Field>
                  <Field id={`${fid}-op`} label={tNodes("filter.fields.operator")}>
                    <Select value={String(config.operator || "equals")} onValueChange={(v) => handleConfigChange("operator", v)}>
                      <SelectTrigger id={`${fid}-op`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["equals", "notEquals", "contains", "greaterThan", "lessThan", "exists"] as const).map((op) => (
                          <SelectItem key={op} value={op}>
                            {tNodes(`filter.fields.operators.${op}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id={`${fid}-value`} label={tNodes("filter.fields.value")}>
                    <Input
                      id={`${fid}-value`}
                      value={String(config.value ?? "")}
                      onChange={(e) => handleConfigChange("value", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
          </TabsContent>

          {/* Test */}
          <TabsContent value="test" className="space-y-5 p-4">
            <div className="rounded-xl border border-line bg-surface p-3.5">
              <SectionTitle>{t("lastRun")}</SectionTitle>
              {data.executionState ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 font-medium text-fg">
                      <StatusIcon status={data.executionState} />
                      {tStatus(data.executionState)}
                    </span>
                    {data.executionDurationMs !== undefined && (
                      <span className="font-mono text-xs tabular-nums text-fg-muted">{formatDuration(data.executionDurationMs)}</span>
                    )}
                  </div>
                  {data.executionError && (
                    <p className="break-all rounded-lg border border-failed/30 bg-failed/10 p-2 font-mono text-xs text-fg">
                      {data.executionError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-[13px] text-fg-muted">{t("noRunYet")}</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <SectionTitle>{t("sandboxTitle")}</SectionTitle>
                <p className="mt-1 text-[13px] leading-5 text-fg-muted">{t("sandboxHint")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleRunStepTest} loading={isTesting} className="flex-1">
                  {!isTesting && <FlaskConical aria-hidden />}
                  {isTesting ? t("testing") : t("runTest")}
                </Button>
                {nodeType === "webhook" && (
                  <Button variant="secondary" onClick={handleDispatchWebhookTest} loading={isSendingWebhook}>
                    {!isSendingWebhook && <Send aria-hidden />} {t("pingWebhook")}
                  </Button>
                )}
              </div>

              {testResult && (
                <div className="space-y-2 rounded-xl border border-line bg-surface p-3" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fg">{t("response")}</span>
                    <span className="flex items-center gap-2 text-fg-muted">
                      {testResult.success ? (
                        <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                      ) : (
                        <XCircle className="size-3.5 text-failed" aria-hidden />
                      )}
                      <span className="font-mono">
                        {t("status")} {testResult.statusCode ?? (testResult.success ? 200 : 500)}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums">{formatDuration(testResult.durationMs)}</span>
                    </span>
                  </div>
                  {testResult.error ? (
                    <p className="break-all rounded-lg border border-failed/30 bg-failed/10 p-2 font-mono text-xs text-fg">
                      {testResult.error}
                    </p>
                  ) : (
                    <JsonView value={testResult.data} maxHeight="max-h-60" />
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Variables */}
          <TabsContent value="variables" className="space-y-5 p-4">
            <p className="text-[13px] leading-5 text-fg-muted">{t("variablesHint", { open: "{{" })}</p>
            <VariableGroup title={t("triggerVars")} refs={triggerRefs.map((r) => ({ ref: r }))} tone="var(--node-trigger)" />
            <VariableGroup
              title={t("upstreamVars")}
              refs={upstream.map((u) => ({ ref: u.ref, hint: t("from", { label: u.label }) }))}
              empty={t("noUpstream")}
              tone="var(--node-action)"
            />
            <VariableGroup title={t("vaultVars")} refs={vaultRefs.map((r) => ({ ref: r }))} empty={t("noVault")} tone="var(--success)" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function VariableGroup({
  title,
  refs,
  empty,
  tone,
}: {
  title: string;
  refs: { ref: string; hint?: string }[];
  empty?: string;
  tone: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-medium text-fg-subtle">
        <span className="size-1.5 rounded-full" style={{ background: tone }} aria-hidden />
        {title}
      </h3>
      {refs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-fg-subtle">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {refs.map((r) => (
            <li key={r.ref}>
              <VariableChip refText={r.ref} hint={r.hint} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VariableChip({ refText, hint }: { refText: string; hint?: string }) {
  const t = useTranslations("editor.inspector");
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copy(refText)) toast.success(t("copied", { ref: refText }));
      }}
      className={cn(
        "group flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors",
        "hover:border-line-strong hover:bg-surface-2 pointer-coarse:py-3"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs text-fg">{refText}</span>
        {hint ? <span className="block truncate text-xs text-fg-subtle">{hint}</span> : null}
      </span>
      <CopyIcon copied={copied} className="size-3.5 shrink-0 text-fg-subtle group-hover:text-fg" />
    </button>
  );
}
