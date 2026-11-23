"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DagThumbnail } from "@/components/patterns/dag-thumbnail";
import { WORKFLOW_TEMPLATES } from "@/lib/dag/templates";
import { useSpotlight } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/components/motion/presets";

function newWorkflowId() {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `wf-${rand}`;
}

interface TemplateCardProps {
  title: string;
  description: string;
  meta?: string;
  preview: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function TemplateCard({ title, description, meta, preview, busy, disabled, onSelect }: TemplateCardProps) {
  const onPointerMove = useSpotlight<HTMLButtonElement>();
  return (
    <motion.button
      variants={fadeUp}
      type="button"
      onClick={onSelect}
      onPointerMove={onPointerMove}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn(
        "spotlight group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-left shadow-elev-1",
        "transition-[border-color,transform,box-shadow] duration-200 ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elev-2",
        "disabled:opacity-60"
      )}
    >
      <div className="relative h-28 border-b border-line bg-dot-grid p-3">{preview}</div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-fg">{title}</span>
          {busy ? (
            <Loader2 className="size-4 animate-spin text-fg-subtle" aria-hidden />
          ) : (
            <ArrowRight className="size-4 -translate-x-1 text-fg-subtle opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
          )}
        </div>
        <p className="line-clamp-2 text-[13px] leading-5 text-fg-muted">{description}</p>
        {meta ? <p className="mt-auto pt-2 text-xs text-fg-subtle">{meta}</p> : null}
      </div>
    </motion.button>
  );
}

/** Template gallery → navigates to a fresh workflow id (saved on first Save). */
export function NewWorkflowDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("templates");
  const tUi = useTranslations("ui");
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setBusyId(null);
  }, [open]);

  function create(templateId: string) {
    setBusyId(templateId);
    router.push(`/workflows/${newWorkflowId()}?template=${encodeURIComponent(templateId)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" closeLabel={tUi("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="p-5">
          <motion.div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="show"
            variants={staggerContainer(0.05)}
          >
            <TemplateCard
              title={t("blank")}
              description={t("blankHint")}
              busy={busyId === "blank"}
              disabled={busyId !== null}
              onSelect={() => create("blank")}
              preview={
                <div className="flex h-full items-center justify-center">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-dashed border-line-strong text-fg-subtle transition-colors group-hover:border-accent group-hover:text-accent">
                    <Plus className="size-5" aria-hidden />
                  </span>
                </div>
              }
            />
            {WORKFLOW_TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                title={tpl.name}
                description={tpl.description}
                meta={t("steps", { count: tpl.nodes.length })}
                busy={busyId === tpl.id}
                disabled={busyId !== null}
                onSelect={() => create(tpl.id)}
                preview={<DagThumbnail nodes={tpl.nodes} edges={tpl.edges} />}
              />
            ))}
          </motion.div>
          {busyId ? (
            <p className="mt-4 text-center text-xs text-fg-subtle" role="status">
              {t("opening")}
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
