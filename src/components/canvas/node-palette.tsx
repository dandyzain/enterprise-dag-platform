"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Play,
  Webhook,
  Send,
  GitBranch,
  Plus,
  GripVertical,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { WorkflowNodeType } from "@/lib/dag/types";
import { Button } from "@/components/ui/button";

interface NodePaletteProps {
  onAddNode: (type: WorkflowNodeType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function NodePalette({
  onAddNode,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: NodePaletteProps) {
  const t = useTranslations("nodes");
  const tCommon = useTranslations("workflow.palette");

  const items: {
    type: WorkflowNodeType;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    name: string;
    description: string;
  }[] = [
    {
      type: "trigger",
      icon: Play,
      color: "text-violet-400",
      bgColor: "bg-violet-950/30 border-violet-500/20 group-hover:border-violet-500/40",
      name: t("trigger.name"),
      description: t("trigger.description"),
    },
    {
      type: "webhook",
      icon: Webhook,
      color: "text-purple-400",
      bgColor: "bg-purple-950/30 border-purple-500/20 group-hover:border-purple-500/40",
      name: t("webhook.name"),
      description: t("webhook.description"),
    },
    {
      type: "action",
      icon: Send,
      color: "text-sky-400",
      bgColor: "bg-sky-950/30 border-sky-500/20 group-hover:border-sky-500/40",
      name: t("action.name"),
      description: t("action.description"),
    },
    {
      type: "filter",
      icon: GitBranch,
      color: "text-amber-400",
      bgColor: "bg-amber-950/30 border-amber-500/20 group-hover:border-amber-500/40",
      name: t("filter.name"),
      description: t("filter.description"),
    },
  ];

  function onDragStart(event: React.DragEvent, nodeType: WorkflowNodeType) {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleSelectNode(type: WorkflowNodeType) {
    onAddNode(type);
    if (onCloseMobile) {
      onCloseMobile();
    }
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`
          ${isOpenMobile ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl animate-in slide-in-from-left duration-200" : "hidden md:flex"}
          ${isCollapsed ? "w-14" : "w-64 lg:w-72"}
          border-r border-zinc-800 bg-zinc-950/95 backdrop-blur-md flex-col h-full shrink-0 transition-all duration-200 select-none
        `}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between">
          {!isCollapsed && (
            <div className="min-w-0 pr-2">
              <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider truncate">
                {tCommon("title")}
              </h2>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                {tCommon("subtitle")}
              </p>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {/* Desktop Collapse Toggle */}
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="hidden md:flex h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                title={isCollapsed ? "Expand Palette" : "Collapse Palette"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseMobile}
                className="md:hidden h-7 w-7 text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Node Items List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;

            if (isCollapsed) {
              return (
                <button
                  key={item.type}
                  onClick={() => handleSelectNode(item.type)}
                  className={`w-full h-9 flex items-center justify-center rounded-lg border ${item.bgColor} ${item.color} hover:brightness-125 transition-all`}
                  title={`Add ${item.name}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            }

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                onClick={() => handleSelectNode(item.type)}
                className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 hover:bg-zinc-850 hover:border-zinc-700 transition-all duration-150 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border ${item.bgColor} ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-zinc-200 group-hover:text-zinc-50">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500 group-hover:text-zinc-300">
                    <GripVertical className="h-3.5 w-3.5" />
                    <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer Guidance for Drag & Drop */}
        {!isCollapsed && (
          <div className="p-3 border-t border-zinc-800/60 hidden md:block">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Layers className="h-3 w-3 shrink-0" />
              <span>Drag & drop onto canvas or click to add</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
