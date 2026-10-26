"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Save,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Workflow as WorkflowIcon,
  Loader2,
  LayoutGrid,
  Download,
  Upload,
  Layers,
  Zap,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/routing";
import { NexusLogoMark } from "@/components/brand/logo";
import { SessionUser } from "@/lib/services/auth-service";
import { UserNav } from "@/components/auth/user-nav";
import { hasPermission } from "@/lib/auth/rbac";

interface WorkflowNavbarProps {
  workflowId: string;
  workflowName: string;
  workflowStatus: "DRAFT" | "PUBLISHED" | "DISABLED";
  isSaving: boolean;
  isPublishing?: boolean;
  isExecuting: boolean;
  hasCycleError: boolean;
  session?: SessionUser | null;
  onNameChange: (newName: string) => void;
  onSave: () => void;
  onPublish?: () => void;
  onExecuteTest: () => void;
  onDispatchQueue?: () => void;
  onResetExecution: () => void;
  onOpenHistory?: () => void;
  onOpenWebhookConsole?: () => void;
  onAutoLayout?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
  onSelectTemplate?: (templateId: string) => void;
}

export function WorkflowNavbar({
  workflowId,
  workflowName,
  workflowStatus,
  isSaving,
  isPublishing = false,
  isExecuting,
  hasCycleError,
  session,
  onNameChange,
  onSave,
  onPublish,
  onExecuteTest,
  onDispatchQueue,
  onResetExecution,
  onOpenHistory,
  onOpenWebhookConsole,
  onAutoLayout,
  onExportJSON,
  onImportJSON,
  onSelectTemplate,
}: WorkflowNavbarProps) {
  const t = useTranslations("common");
  const tWorkflow = useTranslations("workflow");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowName);

  const canEdit = session ? hasPermission(session.role, "workflow:edit") : true;
  const canPublish = session ? hasPermission(session.role, "workflow:publish") : true;

  function handleNameBlur() {
    setIsEditingName(false);
    if (tempName.trim()) {
      onNameChange(tempName.trim());
    } else {
      setTempName(workflowName);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleNameBlur();
    } else if (e.key === "Escape") {
      setTempName(workflowName);
      setIsEditingName(false);
    }
  }

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 select-none gap-2">
      {/* Left: Brand + Breadcrumb + Workflow Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link
          href={`/`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
          title={t("back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="h-4 w-px bg-zinc-800 shrink-0 hidden sm:block" />

        <div className="flex items-center gap-2 min-w-0">
          <NexusLogoMark size={26} animated />

          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-7 w-32 sm:w-48 md:w-64 rounded border border-emerald-500 bg-zinc-900 px-2 text-xs font-semibold text-zinc-100 focus:outline-none"
            />
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-1.5 cursor-pointer min-w-0"
              title="Click to edit name"
            >
              <span className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors truncate max-w-[100px] xs:max-w-[130px] sm:max-w-[180px] md:max-w-[260px] lg:max-w-[340px]">
                {workflowName || tWorkflow("untitled")}
              </span>
            </div>
          )}

          <Badge
            variant={
              workflowStatus === "PUBLISHED"
                ? "default"
                : workflowStatus === "DISABLED"
                ? "failed"
                : "neutral"
            }
            className="hidden sm:inline-flex shrink-0 text-[10px] py-0 px-1.5"
          >
            {tWorkflow(`status.${workflowStatus.toLowerCase()}`)}
          </Badge>

          {hasCycleError && (
            <div className="flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-1.5 sm:px-2 py-0.5 text-[10px] font-medium text-rose-400 shrink-0">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="hidden xs:inline">Cycle Detected</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions, Execution & Language Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Desktop-Only Tools: Auto-Tidy (visible on xl+) */}
        {onAutoLayout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoLayout}
            className="hidden xl:inline-flex border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
            title="Auto-Layout Hierarchical DAG"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-zinc-400" />
            <span>Auto-Tidy</span>
          </Button>
        )}

        {/* Desktop-Only Blueprint & Templates Dropdown (visible on xl+) */}
        <div className="hidden xl:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
              >
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                <span>Blueprints</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-zinc-800 bg-zinc-900">
              {onExportJSON && (
                <DropdownMenuItem
                  onClick={onExportJSON}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>Export Workflow (JSON)</span>
                </DropdownMenuItem>
              )}
              {onImportJSON && (
                <DropdownMenuItem
                  onClick={onImportJSON}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Import Workflow (JSON)</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Preset Templates
              </div>
              {onSelectTemplate && (
                <>
                  <DropdownMenuItem
                    onClick={() => onSelectTemplate("customer-enrichment")}
                    className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                  >
                    <WorkflowIcon className="h-3.5 w-3.5 text-violet-400" />
                    <span>Customer Onboarding</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onSelectTemplate("stripe-webhook-ledger")}
                    className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                  >
                    <WorkflowIcon className="h-3.5 w-3.5 text-amber-400" />
                    <span>Stripe Inbound Ledger</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop-Only Webhook Simulator Console (visible on xl+) */}
        {onOpenWebhookConsole && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenWebhookConsole}
            className="hidden xl:inline-flex border-violet-500/30 bg-violet-950/20 hover:bg-violet-900/30 text-violet-300 gap-1.5"
            title="Open Inbound Webhook Simulator Console"
          >
            <Radio className="h-3.5 w-3.5 text-violet-400" />
            <span>Webhook Console</span>
          </Button>
        )}

        {/* Desktop-Only Telemetry History Logs (visible on xl+) */}
        {onOpenHistory && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            className="hidden xl:inline-flex border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
            title="Inspect Execution History & Telemetry"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
            <span>Telemetry Logs</span>
          </Button>
        )}

        {/* Responsive "Tools" Dropdown (Shown on screens < xl to avoid overflowing) */}
        <div className="xl:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1 px-2 sm:px-2.5"
                title="Secondary DAG Tools & Presets"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden sm:inline text-xs">Tools</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-zinc-800 bg-zinc-900">
              {onAutoLayout && (
                <DropdownMenuItem
                  onClick={onAutoLayout}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Auto-Tidy DAG</span>
                </DropdownMenuItem>
              )}

              {onOpenWebhookConsole && (
                <DropdownMenuItem
                  onClick={onOpenWebhookConsole}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-violet-300"
                >
                  <Radio className="h-3.5 w-3.5 text-violet-400" />
                  <span>Webhook Simulator Console</span>
                </DropdownMenuItem>
              )}

              {onOpenHistory && (
                <DropdownMenuItem
                  onClick={onOpenHistory}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-emerald-300"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Telemetry Logs</span>
                </DropdownMenuItem>
              )}

              {onDispatchQueue && (
                <DropdownMenuItem
                  onClick={onDispatchQueue}
                  disabled={isExecuting || isSaving || hasCycleError}
                  className="flex sm:hidden items-center gap-2 text-xs py-2 cursor-pointer text-amber-300"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Dispatch BullMQ Queue</span>
                </DropdownMenuItem>
              )}

              {onPublish && (
                <DropdownMenuItem
                  onClick={onPublish}
                  disabled={isPublishing || isSaving || hasCycleError}
                  className="flex md:hidden items-center gap-2 text-xs py-2 cursor-pointer text-violet-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                  <span>{t("publish")}</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {onExportJSON && (
                <DropdownMenuItem
                  onClick={onExportJSON}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>Export JSON</span>
                </DropdownMenuItem>
              )}
              {onImportJSON && (
                <DropdownMenuItem
                  onClick={onImportJSON}
                  className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Import JSON</span>
                </DropdownMenuItem>
              )}

              {onSelectTemplate && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Preset Templates
                  </div>
                  <DropdownMenuItem
                    onClick={() => onSelectTemplate("customer-enrichment")}
                    className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                  >
                    <WorkflowIcon className="h-3.5 w-3.5 text-violet-400" />
                    <span>Customer Onboarding</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onSelectTemplate("stripe-webhook-ledger")}
                    className="flex items-center gap-2 text-xs py-2 cursor-pointer text-zinc-200"
                  >
                    <WorkflowIcon className="h-3.5 w-3.5 text-amber-400" />
                    <span>Stripe Inbound Ledger</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Primary Action 1: Test Run */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onExecuteTest}
          disabled={isExecuting || isSaving || hasCycleError}
          className="border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 shadow-sm px-2.5 sm:px-3 hover:scale-[1.02] active:scale-[0.98] transition-all group"
          title="Simulate DAG topological execution on canvas"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
              <span className="hidden sm:inline">{t("testing")}</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/20 group-hover:scale-110 transition-transform" />
              <span className="hidden xs:inline">{t("testRun")}</span>
            </>
          )}
        </Button>

        {/* Primary Action 2: Dispatch BullMQ Queue (visible on sm+) */}
        {onDispatchQueue && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDispatchQueue}
            disabled={isExecuting || isSaving || hasCycleError}
            className="hidden sm:inline-flex border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 gap-1.5 shadow-sm px-2.5 sm:px-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Dispatch DAG execution to BullMQ distributed queue and stream live progress via SSE"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                <span className="hidden md:inline">Streaming...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20 animate-bounce-subtle" />
                <span className="hidden md:inline">Dispatch Queue</span>
              </>
            )}
          </Button>
        )}

        {/* Primary Action 3: Save Button */}
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={isSaving || isExecuting || !canEdit}
          title={!canEdit ? "Read-only access (Viewer Role)" : "Save workflow changes"}
          className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold px-2.5 sm:px-3"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden xs:inline">{t("saving")}</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">{t("save")}</span>
            </>
          )}
        </Button>

        {/* Primary Action 4: Publish (visible on md+) */}
        {onPublish && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPublish}
            disabled={isPublishing || isSaving || hasCycleError || !canPublish}
            title={!canPublish ? "Publishing requires Admin/Owner Role" : "Publish workflow"}
            className="hidden md:inline-flex border-violet-500/30 bg-violet-950/20 hover:bg-violet-900/30 text-violet-300 gap-1"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden lg:inline">{t("publishing")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                <span className="hidden lg:inline">{t("publish")}</span>
              </>
            )}
          </Button>
        )}

        <div className="h-4 w-px bg-zinc-800 mx-0.5 sm:mx-1 hidden xs:block" />

        <LanguageSwitcher />

        {session && <UserNav session={session} />}
      </div>
    </header>
  );
}
