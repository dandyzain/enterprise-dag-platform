"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Require typing this exact value before confirming (destructive actions). */
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  confirmText,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("ui");
  const tCommon = useTranslations("common");
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputId = React.useId();

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const blocked = Boolean(confirmText) && typed !== confirmText;

  async function handleConfirm() {
    if (blocked) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        size="sm"
        role="alertdialog"
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-row items-start gap-3 border-b-0 pb-2 pr-5">
          {tone === "danger" && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-failed/10 text-failed">
              <AlertTriangle className="size-4" aria-hidden />
            </div>
          )}
          <div className="space-y-1">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
        </DialogHeader>
        {confirmText ? (
          <DialogBody className="pt-1">
            <div className="space-y-1.5">
              <Label htmlFor={inputId}>
                {t.rich("typeToConfirm", {
                  value: () => <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs">{confirmText}</code>,
                })}
              </Label>
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />
            </div>
          </DialogBody>
        ) : null}
        <DialogFooter className="border-t-0 bg-transparent">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel ?? tCommon("cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "default"}
            onClick={handleConfirm}
            disabled={blocked}
            loading={busy}
            autoFocus={!confirmText}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
