"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import type { WorkflowNodeType } from "@/lib/dag/types";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import { NODE_META, NODE_TYPES } from "./node-meta";
import { duration, ease } from "@/components/motion/presets";

interface NodePickerProps {
  open: boolean;
  /** Screen position to anchor the picker at (falls back to centred). */
  at: { x: number; y: number } | null;
  /** Restrict choices (e.g. no triggers when inserting mid-graph). */
  allowed?: WorkflowNodeType[];
  onSelect: (type: WorkflowNodeType) => void;
  onClose: () => void;
}

const GROUPS = ["triggers", "actions", "logic"] as const;

function PickerList({ allowed, onSelect }: { allowed: WorkflowNodeType[]; onSelect: (t: WorkflowNodeType) => void }) {
  const t = useTranslations("editor.picker");
  const tNodes = useTranslations("nodes");
  return (
    <Command loop className="bg-transparent">
      <CommandInput placeholder={t("placeholder")} autoFocus />
      <CommandList className="max-h-80">
        <CommandEmpty>{t("empty")}</CommandEmpty>
        {GROUPS.map((group) => {
          const items = NODE_TYPES.filter((type) => NODE_META[type].group === group && allowed.includes(type));
          if (!items.length) return null;
          return (
            <CommandGroup key={group} heading={t(`groups.${group}`)}>
              {items.map((type) => {
                const meta = NODE_META[type];
                const Icon = meta.icon;
                return (
                  <CommandItem key={type} value={`${tNodes(`${type}.name`)} ${type}`} onSelect={() => onSelect(type)}>
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:!text-current"
                      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-fg">{tNodes(`${type}.name`)}</span>
                      <span className="block truncate text-xs text-fg-subtle">{tNodes(`${type}.description`)}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </Command>
  );
}

/** Quick-add step picker: floating panel on desktop, bottom sheet on phones. */
export function NodePicker({ open, at, allowed = NODE_TYPES, onSelect, onClose }: NodePickerProps) {
  const t = useTranslations("editor.picker");
  const isDesktop = useMediaQuery(BREAKPOINTS.md, true);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || !isDesktop) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    function onPointer(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, isDesktop, onClose]);

  if (!open) return null;

  if (!isDesktop) {
    return (
      <Drawer open onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          <PickerList allowed={allowed} onSelect={onSelect} />
        </DrawerContent>
      </Drawer>
    );
  }

  const W = 320;
  const H = 380;
  const pos =
    at && typeof window !== "undefined"
      ? {
          left: Math.min(Math.max(12, at.x - W / 2), window.innerWidth - W - 12),
          top: Math.min(Math.max(12, at.y + 12), window.innerHeight - H - 12),
        }
      : null;

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={t("title")}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: duration.fast, ease: ease.emphasized }}
      className="fixed z-50 overflow-hidden rounded-xl border border-line bg-overlay shadow-elev-3"
      style={
        pos
          ? { left: pos.left, top: pos.top, width: W }
          : { left: "50%", top: "22%", width: W, translateX: "-50%" }
      }
    >
      <PickerList allowed={allowed} onSelect={onSelect} />
    </motion.div>
  );
}
