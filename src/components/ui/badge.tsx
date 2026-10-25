import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        trigger: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
        action: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
        filter: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        failed: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
        running: "bg-amber-500/10 text-amber-300 border border-amber-500/20 animate-pulse",
        neutral: "bg-zinc-800 text-zinc-300 border border-zinc-700/50",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
