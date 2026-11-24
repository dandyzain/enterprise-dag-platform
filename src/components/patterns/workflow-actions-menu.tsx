"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { hasPermission, type MemberRole } from "@/lib/auth/rbac";
import {
  deleteWorkflowAction,
  duplicateWorkflowAction,
  setWorkflowStatusAction,
} from "@/lib/actions/workflow-actions";
import { cn } from "@/lib/utils";

interface WorkflowActionsMenuProps {
  workflow: { id: string; name: string; status: "DRAFT" | "PUBLISHED" | "DISABLED" };
  role: MemberRole;
  className?: string;
  /** Called after a delete so editor pages can navigate away. */
  onDeleted?: () => void;
  onStatusChanged?: (status: "DRAFT" | "PUBLISHED" | "DISABLED") => void;
  align?: "start" | "end";
}

/** Duplicate / enable / disable / delete a workflow (server-enforced RBAC; hidden when not permitted). */
export function WorkflowActionsMenu({ workflow, role, className, onDeleted, onStatusChanged, align = "end" }: WorkflowActionsMenuProps) {
  const t = useTranslations("workflowActions");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canCreate = hasPermission(role, "workflow:create");
  const canPublish = hasPermission(role, "workflow:publish");
  const canDelete = hasPermission(role, "workflow:delete");
  if (!canCreate && !canPublish && !canDelete) return null;

  async function duplicate() {
    setBusy(true);
    try {
      const res = await duplicateWorkflowAction(workflow.id);
      if (!res.success) {
        toast.error(res.error || t("failed"));
        return;
      }
      toast.success(t("duplicated"));
      if (res.workflowId) router.push(`/workflows/${res.workflowId}`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    const next = workflow.status === "DISABLED" ? "PUBLISHED" : "DISABLED";
    setBusy(true);
    try {
      const res = await setWorkflowStatusAction(workflow.id, next);
      if (!res.success) {
        toast.error(res.error || t("failed"));
        return;
      }
      toast.success(next === "DISABLED" ? t("disabled") : t("enabled"));
      onStatusChanged?.(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const res = await deleteWorkflowAction(workflow.id);
    if (!res.success) {
      toast.error(res.error || t("failed"));
      return;
    }
    toast.success(t("deleted", { name: workflow.name }));
    setConfirmOpen(false);
    if (onDeleted) onDeleted();
    else router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("menu", { name: workflow.name })}
            disabled={busy}
            className={cn("relative z-10", className)}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          <DropdownMenuItem onSelect={() => router.push(`/workflows/${workflow.id}`)}>
            <ExternalLink aria-hidden /> {t("open")}
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem onSelect={duplicate} disabled={busy}>
              <Copy aria-hidden /> {t("duplicate")}
            </DropdownMenuItem>
          )}
          {canPublish && workflow.status !== "DRAFT" && (
            <DropdownMenuItem onSelect={toggleStatus} disabled={busy}>
              {workflow.status === "DISABLED" ? <Play aria-hidden /> : <Pause aria-hidden />}
              {workflow.status === "DISABLED" ? t("enable") : t("disable")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
                <Trash2 aria-hidden /> {t("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title={t("confirmTitle")}
        description={t("confirmBody", { name: workflow.name })}
        confirmLabel={t("delete")}
        confirmText={workflow.name}
        onConfirm={remove}
      />
    </>
  );
}
