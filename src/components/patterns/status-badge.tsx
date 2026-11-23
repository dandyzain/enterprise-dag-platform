"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ExecutionStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "DISABLED";

const EXEC_VARIANT = {
  SUCCESS: "success",
  FAILED: "failed",
  RUNNING: "running",
  PENDING: "neutral",
} as const;

export function ExecutionStatusBadge({ status, className }: { status: ExecutionStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <Badge variant={EXEC_VARIANT[status] ?? "neutral"} dot live={status === "RUNNING"} className={className}>
      {t(status)}
    </Badge>
  );
}

const WF_VARIANT = {
  PUBLISHED: "success",
  DRAFT: "neutral",
  DISABLED: "warning",
} as const;

export function WorkflowStatusBadge({ status, className }: { status: WorkflowStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <Badge variant={WF_VARIANT[status] ?? "neutral"} dot className={className}>
      {t(status)}
    </Badge>
  );
}

/** Icon-only status mark with an accessible label (pair with visible text when possible). */
export function StatusIcon({ status, className, label }: { status: ExecutionStatus; className?: string; label?: string }) {
  const t = useTranslations("status");
  const common = cn("size-4 shrink-0", className);
  const aria = { role: "img" as const, "aria-label": label ?? t(status) };
  switch (status) {
    case "SUCCESS":
      return <CheckCircle2 className={cn(common, "text-success")} {...aria} />;
    case "FAILED":
      return <XCircle className={cn(common, "text-failed")} {...aria} />;
    case "RUNNING":
      return <Loader2 className={cn(common, "animate-spin text-running")} {...aria} />;
    default:
      return <Clock className={cn(common, "text-fg-subtle")} {...aria} />;
  }
}
