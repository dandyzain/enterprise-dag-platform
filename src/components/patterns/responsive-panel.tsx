"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface ResponsivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra header content (badges, actions) rendered under the title. */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeLabel?: string;
  className?: string;
  /** Sheet width on desktop. */
  width?: string;
}

/**
 * Side sheet on ≥ md, draggable bottom sheet on mobile — same content, same
 * accessibility guarantees (focus trap, Esc, focus restore).
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  footer,
  children,
  closeLabel,
  className,
  width = "sm:max-w-xl",
}: ResponsivePanelProps) {
  const isDesktop = useMediaQuery(BREAKPOINTS.md, true);

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent closeLabel={closeLabel} className={cn(width, className)}>
          <div className="border-b border-line px-5 py-4 pr-14">
            <SheetTitle className="text-base font-semibold text-fg">{title}</SheetTitle>
            {description ? <SheetDescription className="mt-0.5 text-sm text-fg-muted">{description}</SheetDescription> : null}
            {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("h-[88dvh]", className)}>
        <div className="border-b border-line px-4 pb-3 pt-1">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription className="mt-0.5">{description}</DrawerDescription> : null}
          {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-4 py-3">{footer}</div> : null}
      </DrawerContent>
    </Drawer>
  );
}
