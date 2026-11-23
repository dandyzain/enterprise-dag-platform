"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[70] max-w-xs rounded-md border border-line bg-overlay px-2.5 py-1.5 text-xs text-fg shadow-elev-2",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** When false, renders children without a tooltip (e.g. label already visible). */
  enabled?: boolean;
  shortcut?: React.ReactNode;
}

/** Convenience wrapper: <Tooltip content="Save">…</Tooltip> */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  enabled = true,
  shortcut,
}: TooltipProps) {
  if (!enabled || content === undefined || content === null || content === "") return children;
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        <span className="flex items-center gap-2">
          <span>{content}</span>
          {shortcut ? <span className="text-fg-subtle">{shortcut}</span> : null}
        </span>
      </TooltipContent>
    </TooltipRoot>
  );
}
