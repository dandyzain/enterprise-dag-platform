"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";

export function ShortcutsDialog({ open, onOpenChange, modKey }: { open: boolean; onOpenChange: (o: boolean) => void; modKey: string }) {
  const t = useTranslations("editor");
  const tUi = useTranslations("ui");
  const rows: { keys: string[]; label: string }[] = [
    { keys: [modKey, "S"], label: t("shortcutsList.save") },
    { keys: [modKey, "↵"], label: t("shortcutsList.run") },
    { keys: [modKey, "Z"], label: t("shortcutsList.undo") },
    { keys: [modKey, "⇧", "Z"], label: t("shortcutsList.redo") },
    { keys: ["A"], label: t("shortcutsList.add") },
    { keys: [modKey, "D"], label: t("shortcutsList.duplicate") },
    { keys: ["⌫"], label: t("shortcutsList.delete") },
    { keys: ["F"], label: t("shortcutsList.fit") },
    { keys: ["Esc"], label: t("shortcutsList.deselect") },
    { keys: ["?"], label: t("shortcutsList.help") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={tUi("close")}>
        <DialogHeader>
          <DialogTitle>{t("shortcuts")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="py-2">
          <dl className="divide-y divide-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-fg-muted">{row.label}</dt>
                <dd className="flex items-center gap-1">
                  {row.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
