"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/dag/types";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NODE_META, NODE_TYPES } from "./node-meta";

interface NodePaletteProps {
  onAddNode: (type: WorkflowNodeType) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  readOnly?: boolean;
}

const GROUPS = ["triggers", "actions", "logic"] as const;

/** Desktop step library: drag onto the canvas, or click/Enter to add. */
export function NodePalette({ onAddNode, isCollapsed = false, onToggleCollapse, readOnly = false }: NodePaletteProps) {
  const t = useTranslations("editor.palette");
  const tGroups = useTranslations("editor.picker.groups");
  const tNodes = useTranslations("nodes");
  const [query, setQuery] = React.useState("");

  function onDragStart(event: React.DragEvent, nodeType: WorkflowNodeType) {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  }

  const q = query.trim().toLowerCase();
  const visible = NODE_TYPES.filter(
    (type) => !q || tNodes(`${type}.name`).toLowerCase().includes(q) || tNodes(`${type}.description`).toLowerCase().includes(q)
  );

  return (
    <aside
      aria-label={t("title")}
      className={cn(
        "hidden shrink-0 flex-col border-r border-line bg-surface/60 transition-[width] duration-300 ease-emphasized md:flex",
        isCollapsed ? "w-14" : "w-64"
      )}
    >
      <div className={cn("flex h-12 items-center border-b border-line px-3", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <h2 className="px-1 text-[13px] font-semibold text-fg">{t("title")}</h2>}
        {onToggleCollapse && (
          <Tooltip content={isCollapsed ? t("expand") : t("collapse")} side="right">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? t("expand") : t("collapse")}
              aria-expanded={!isCollapsed}
              className="inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {isCollapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            </button>
          </Tooltip>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-8 pl-8 sm:text-[13px]"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isCollapsed ? (
          <ul className="space-y-1.5">
            {NODE_TYPES.map((type) => {
              const meta = NODE_META[type];
              const Icon = meta.icon;
              return (
                <li key={type}>
                  <Tooltip content={tNodes(`${type}.name`)} side="right">
                    <button
                      type="button"
                      draggable={!readOnly}
                      onDragStart={(e) => onDragStart(e, type)}
                      onClick={() => onAddNode(type)}
                      aria-label={tNodes(`${type}.name`)}
                      className="flex size-8 items-center justify-center rounded-lg transition-transform hover:scale-105 active:scale-95"
                      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            {GROUPS.map((group) => {
              const items = visible.filter((type) => NODE_META[type].group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} aria-label={tGroups(group)}>
                  <h3 className="mb-1.5 px-1 text-xs font-medium text-fg-subtle">{tGroups(group)}</h3>
                  <ul className="space-y-1.5">
                    {items.map((type) => {
                      const meta = NODE_META[type];
                      const Icon = meta.icon;
                      return (
                        <li key={type}>
                          <button
                            type="button"
                            draggable={!readOnly}
                            onDragStart={(e) => onDragStart(e, type)}
                            onClick={() => onAddNode(type)}
                            className={cn(
                              "group flex w-full cursor-grab items-start gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-left shadow-elev-1",
                              "transition-[border-color,transform,box-shadow] duration-150 ease-standard hover:-translate-y-px hover:border-line-strong hover:shadow-elev-2 active:cursor-grabbing"
                            )}
                          >
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
                            >
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-fg">{tNodes(`${type}.name`)}</span>
                              <span className="mt-0.5 line-clamp-2 block text-xs leading-[18px] text-fg-subtle">
                                {tNodes(`${type}.description`)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {!isCollapsed && <p className="border-t border-line px-4 py-3 text-xs leading-5 text-fg-subtle">{t("hint")}</p>}
    </aside>
  );
}
