"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  History,
  Keyboard,
  Layers,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Radio,
  Rocket,
  Save,
  Upload,
  Workflow as WorkflowIcon,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NexusLogoMark } from "@/components/brand/logo";
import { WorkflowStatusBadge } from "@/components/patterns/status-badge";
import type { SessionUser } from "@/lib/services/auth-service";
import { UserNav } from "@/components/auth/user-nav";
import { hasPermission } from "@/lib/auth/rbac";
import { WORKFLOW_TEMPLATES } from "@/lib/dag/templates";
import { cn } from "@/lib/utils";

export type SaveState = "saved" | "unsaved" | "saving";

interface WorkflowNavbarProps {
  workflowName: string;
  workflowStatus: "DRAFT" | "PUBLISHED" | "DISABLED";
  saveState: SaveState;
  isSaving: boolean;
  isPublishing?: boolean;
  isExecuting: boolean;
  hasCycleError: boolean;
  session?: SessionUser | null;
  modKey: string;
  onBack: () => void;
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
  onOpenShortcuts: () => void;
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("editor");
  return (
    <span className="hidden items-center gap-1.5 text-xs text-fg-subtle md:inline-flex" role="status" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-1.5"
        >
          {state === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {state === "saved" && (
            <svg viewBox="0 0 24 24" className="nf-check size-3.5 text-success" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {state === "unsaved" && <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
          {state === "saving" ? t("saving") : state === "saved" ? t("saved") : t("unsaved")}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function WorkflowNavbar({
  workflowName,
  workflowStatus,
  saveState,
  isSaving,
  isPublishing = false,
  isExecuting,
  hasCycleError,
  session,
  modKey,
  onBack,
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
  onOpenShortcuts,
}: WorkflowNavbarProps) {
  const t = useTranslations("editor");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowName);
  const inputRef = useRef<HTMLInputElement>(null);

  const canEdit = session ? hasPermission(session.role, "workflow:edit") : true;
  const canPublish = session ? hasPermission(session.role, "workflow:publish") : true;
  const runDisabled = isExecuting || isSaving || hasCycleError;

  useEffect(() => {
    if (!isEditingName) setTempName(workflowName);
  }, [workflowName, isEditingName]);

  useEffect(() => {
    if (isEditingName) inputRef.current?.select();
  }, [isEditingName]);

  function commitName() {
    setIsEditingName(false);
    if (tempName.trim()) onNameChange(tempName.trim());
    else setTempName(workflowName);
  }

  const templatesMenu = onSelectTemplate ? (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Layers aria-hidden /> {t("templates")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        {WORKFLOW_TEMPLATES.map((tpl) => (
          <DropdownMenuItem key={tpl.id} onSelect={() => onSelectTemplate(tpl.id)}>
            <WorkflowIcon aria-hidden />
            <span className="truncate">{tpl.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  ) : null;

  return (
    <header className="pt-safe z-30 shrink-0 border-b border-line bg-overlay/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-2 sm:px-3">
        {/* Left: back, brand, name, status */}
        <Tooltip content={t("back")}>
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("back")}>
            <ArrowLeft aria-hidden />
          </Button>
        </Tooltip>
        <span className="group hidden md:inline-flex">
          <NexusLogoMark size={24} animated />
        </span>
        <span className="mx-1 hidden h-5 w-px bg-line md:block" aria-hidden />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={tempName}
              aria-label={t("nameLabel")}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                else if (e.key === "Escape") {
                  e.stopPropagation();
                  setTempName(workflowName);
                  setIsEditingName(false);
                }
              }}
              className="h-8 w-full min-w-0 max-w-xs rounded-lg border border-accent bg-surface px-2.5 text-sm font-medium text-fg outline-none ring-3 ring-accent/20"
            />
          ) : (
            <button
              type="button"
              onClick={() => canEdit && setIsEditingName(true)}
              disabled={!canEdit}
              aria-label={`${t("rename")}: ${workflowName || t("untitled")}`}
              className="group flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2 disabled:hover:bg-transparent"
            >
              <span className="truncate text-sm font-semibold text-fg">{workflowName || t("untitled")}</span>
              {canEdit && <Pencil className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
            </button>
          )}
          <WorkflowStatusBadge status={workflowStatus} className="hidden sm:inline-flex" />
          {!canEdit && (
            <Tooltip content={t("readOnlyHint")}>
              <Badge variant="outline" className="hidden sm:inline-flex" tabIndex={0}>
                <Eye className="size-3" aria-hidden /> {t("readOnly")}
              </Badge>
            </Tooltip>
          )}
          {hasCycleError && (
            <Tooltip content={t("cycleHint")}>
              <Badge variant="failed" className="shrink-0" tabIndex={0}>
                <AlertTriangle className="size-3 text-failed" aria-hidden />
                <span className="hidden xs:inline">{t("cycle")}</span>
              </Badge>
            </Tooltip>
          )}
          <SaveIndicator state={saveState} />
        </div>

        {/* Right: secondary tools (lg+) */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {onOpenHistory && (
            <Tooltip content={t("history")}>
              <Button variant="ghost" size="icon-sm" onClick={onOpenHistory} aria-label={t("history")}>
                <History aria-hidden />
              </Button>
            </Tooltip>
          )}
          {onOpenWebhookConsole && (
            <Tooltip content={t("webhookConsole")}>
              <Button variant="ghost" size="icon-sm" onClick={onOpenWebhookConsole} aria-label={t("webhookConsole")}>
                <Radio aria-hidden />
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Overflow menu (all sizes) */}
        <DropdownMenu>
          <Tooltip content={t("more")}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("more")}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-60">
            {/* Primary actions surface here on small screens */}
            <div className="sm:hidden">
              <DropdownMenuItem onSelect={onSave} disabled={isSaving || isExecuting || !canEdit}>
                <Save aria-hidden /> {t("save")}
                <DropdownMenuShortcut>{modKey}S</DropdownMenuShortcut>
              </DropdownMenuItem>
              {onPublish && (
                <DropdownMenuItem onSelect={onPublish} disabled={isPublishing || isSaving || hasCycleError || !canPublish}>
                  <Rocket aria-hidden /> {t("publish")}
                </DropdownMenuItem>
              )}
              {onDispatchQueue && (
                <DropdownMenuItem onSelect={onDispatchQueue} disabled={runDisabled}>
                  <Zap aria-hidden /> {t("dispatch")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </div>
            <div className="lg:hidden">
              {onOpenHistory && (
                <DropdownMenuItem onSelect={onOpenHistory}>
                  <History aria-hidden /> {t("history")}
                </DropdownMenuItem>
              )}
              {onOpenWebhookConsole && (
                <DropdownMenuItem onSelect={onOpenWebhookConsole}>
                  <Radio aria-hidden /> {t("webhookConsole")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </div>
            {onAutoLayout && (
              <DropdownMenuItem onSelect={onAutoLayout}>
                <LayoutGrid aria-hidden /> {t("autoLayout")}
              </DropdownMenuItem>
            )}
            {templatesMenu}
            <DropdownMenuSeparator />
            {onExportJSON && (
              <DropdownMenuItem onSelect={onExportJSON}>
                <Download aria-hidden /> {t("export")}
              </DropdownMenuItem>
            )}
            {onImportJSON && (
              <DropdownMenuItem onSelect={onImportJSON}>
                <Upload aria-hidden /> {t("import")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onResetExecution}>
              <Eraser aria-hidden /> {t("clearRun")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenShortcuts}>
              <Keyboard aria-hidden /> {t("shortcuts")}
              <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />

        {/* Run split button */}
        <div className="flex items-center">
          <Tooltip content={t("testRunHint")} shortcut={<Kbd>{modKey}↵</Kbd>}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onExecuteTest}
              disabled={runDisabled}
              className={cn("gap-1.5", onDispatchQueue && "sm:rounded-r-none")}
            >
              {isExecuting ? <Loader2 className="animate-spin text-running" aria-hidden /> : <Play className="fill-current text-success" aria-hidden />}
              <span className="hidden xs:inline">{isExecuting ? t("running") : t("run")}</span>
              <span className="sr-only xs:hidden">{t("run")}</span>
            </Button>
          </Tooltip>
          {onDispatchQueue && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t("runOptions")}
                  disabled={runDisabled}
                  className="hidden w-7 rounded-l-none border-l-0 px-0 sm:inline-flex"
                >
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>{t("runOptions")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={onExecuteTest} className="items-start">
                  <Play className="mt-0.5" aria-hidden />
                  <span>
                    <span className="block font-medium">{t("run")}</span>
                    <span className="block text-xs text-fg-subtle">{t("testRunHint")}</span>
                  </span>
                  <DropdownMenuShortcut>{modKey}↵</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDispatchQueue} className="items-start">
                  <Zap className="mt-0.5" aria-hidden />
                  <span>
                    <span className="block font-medium">{t("dispatch")}</span>
                    <span className="block text-xs text-fg-subtle">{t("dispatchHint")}</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Tooltip content={!canEdit ? t("readOnlyHint") : t("save")} shortcut={canEdit ? <Kbd>{modKey}S</Kbd> : undefined}>
          <span className="hidden sm:inline-flex">
            <Button variant="secondary" size="sm" onClick={onSave} disabled={isSaving || isExecuting || !canEdit} loading={isSaving}>
              {!isSaving && (saveState === "saved" ? <Check aria-hidden /> : <Save aria-hidden />)}
              <span className="hidden lg:inline">{isSaving ? t("saving") : t("save")}</span>
            </Button>
          </span>
        </Tooltip>

        {onPublish && (
          <Tooltip content={!canPublish ? t("publishRequires") : t("publish")}>
            <span className="hidden sm:inline-flex">
              <Button
                size="sm"
                onClick={onPublish}
                disabled={isPublishing || isSaving || hasCycleError || !canPublish}
                loading={isPublishing}
              >
                {!isPublishing && <Rocket aria-hidden />}
                <span className="hidden md:inline">{isPublishing ? t("publishing") : t("publish")}</span>
              </Button>
            </span>
          </Tooltip>
        )}

        <span className="mx-0.5 hidden h-5 w-px bg-line md:block" aria-hidden />
        <div className="hidden items-center gap-0.5 md:flex">
          <ThemeToggle />
          <LanguageSwitcher compact />
        </div>
        {session && (
          <div className="ml-1">
            <UserNav session={session} variant="compact" />
          </div>
        )}
      </div>
    </header>
  );
}
