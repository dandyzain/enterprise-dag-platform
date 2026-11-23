import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <div className="text-xs font-medium text-fg-subtle">{eyebrow}</div> : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-fg sm:text-[28px] sm:leading-9">{title}</h1>
        {description ? <p className="max-w-2xl text-pretty text-sm leading-6 text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
