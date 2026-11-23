"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "right" | "left";
  closeLabel?: string;
  hideClose?: boolean;
}

/** Side panel built on Radix Dialog: focus trap, Esc to close, focus restore. */
export const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, side = "right", children, closeLabel = "Close", hideClose = false, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-full flex-col border-line bg-overlay text-fg shadow-elev-3 outline-none sm:max-w-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-300 ease-emphasized",
          side === "right"
            ? "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
            : "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg pointer-coarse:size-10"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
);
SheetContent.displayName = "SheetContent";
