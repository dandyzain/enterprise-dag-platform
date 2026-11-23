import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-[13px] font-medium leading-5 text-fg", className)} {...props} />
  )
);
Label.displayName = "Label";

/** Returns the aria-describedby value for a field with optional hint / error. */
export function describedBy(id: string, opts: { hint?: React.ReactNode; error?: React.ReactNode }) {
  if (opts.error) return `${id}-error`;
  if (opts.hint) return `${id}-hint`;
  return undefined;
}

interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + hint/error, wired for assistive tech. The control must use
 * `id={id}` and `aria-describedby={describedBy(id, { hint, error })}`.
 */
export function Field({ id, label, hint, error, optional, action, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {optional ? <span className="ml-1.5 font-normal text-fg-subtle">{optional}</span> : null}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs leading-5 text-failed">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
