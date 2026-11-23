"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useReactFlow, useViewport } from "@xyflow/react";
import { LayoutGrid, Maximize, Minus, PanelBottom, Plus, Redo2, SquarePlus, Undo2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  onAddStep: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAutoLayout: () => void;
  runPanelOpen: boolean;
  onToggleRunPanel: () => void;
  readOnly?: boolean;
  modKey: string;
}

function ToolButton({
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  children,
  className,
}: {
  label: string;
  shortcut?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors",
          "hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-10",
          pressed && "bg-surface-3 text-fg",
          className
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />;

/** Floating, bottom-centred canvas tools. */
export function CanvasToolbar({
  onAddStep,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAutoLayout,
  runPanelOpen,
  onToggleRunPanel,
  readOnly,
  modKey,
}: CanvasToolbarProps) {
  const t = useTranslations("editor.toolbar");
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div
      role="toolbar"
      aria-label={t("label")}
      className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-line bg-overlay/95 p-1 shadow-elev-3 backdrop-blur"
    >
      {!readOnly && (
        <>
          <Tooltip content={t("addStep")} shortcut={<Kbd>A</Kbd>}>
            <button
              type="button"
              onClick={onAddStep}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-solid px-2.5 text-[13px] font-medium text-accent-solid-fg transition-colors hover:bg-accent-solid-hover active:scale-[0.97] pointer-coarse:h-10"
            >
              <SquarePlus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("addStep")}</span>
              <span className="sr-only sm:hidden">{t("addStep")}</span>
            </button>
          </Tooltip>
          <Divider />
          <ToolButton label={t("undo")} shortcut={<Kbd>{modKey}Z</Kbd>} onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label={t("redo")} shortcut={<Kbd>{modKey}⇧Z</Kbd>} onClick={onRedo} disabled={!canRedo}>
            <Redo2 className="size-4" aria-hidden />
          </ToolButton>
          <Divider />
        </>
      )}
      <ToolButton label={t("zoomOut")} onClick={() => zoomOut({ duration: 200 })} className="hidden sm:inline-flex">
        <Minus className="size-4" aria-hidden />
      </ToolButton>
      <span className="hidden w-11 text-center font-mono text-xs tabular-nums text-fg-subtle sm:block" aria-live="off">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton label={t("zoomIn")} onClick={() => zoomIn({ duration: 200 })} className="hidden sm:inline-flex">
        <Plus className="size-4" aria-hidden />
      </ToolButton>
      <ToolButton label={t("fit")} shortcut={<Kbd>F</Kbd>} onClick={() => fitView({ duration: 400, padding: 0.3, maxZoom: 1 })}>
        <Maximize className="size-4" aria-hidden />
      </ToolButton>
      {!readOnly && (
        <ToolButton label={t("layout")} onClick={onAutoLayout}>
          <LayoutGrid className="size-4" aria-hidden />
        </ToolButton>
      )}
      <Divider />
      <ToolButton label={t("runPanel")} onClick={onToggleRunPanel} pressed={runPanelOpen}>
        <PanelBottom className="size-4" aria-hidden />
      </ToolButton>
    </div>
  );
}
