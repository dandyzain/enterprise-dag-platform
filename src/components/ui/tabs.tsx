"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: "pill" | "underline" }
>(({ className, variant = "underline", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(
      "group/tabs scrollbar-none flex items-center overflow-x-auto",
      variant === "underline" ? "gap-1 border-b border-line" : "gap-1 rounded-xl border border-line bg-surface p-1",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium text-fg-muted",
      "transition-colors duration-150 ease-standard hover:text-fg disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:size-4 [&_svg]:shrink-0",
      // underline variant
      "group-data-[variant=underline]/tabs:h-10 group-data-[variant=underline]/tabs:px-3",
      "group-data-[variant=underline]/tabs:after:absolute group-data-[variant=underline]/tabs:after:inset-x-2 group-data-[variant=underline]/tabs:after:-bottom-px group-data-[variant=underline]/tabs:after:h-0.5 group-data-[variant=underline]/tabs:after:rounded-full",
      "group-data-[variant=underline]/tabs:after:scale-x-0 group-data-[variant=underline]/tabs:after:bg-fg group-data-[variant=underline]/tabs:after:transition-transform group-data-[variant=underline]/tabs:after:duration-200",
      "group-data-[variant=underline]/tabs:data-[state=active]:text-fg group-data-[variant=underline]/tabs:data-[state=active]:after:scale-x-100",
      // pill variant
      "group-data-[variant=pill]/tabs:h-8 group-data-[variant=pill]/tabs:rounded-lg group-data-[variant=pill]/tabs:px-3",
      "group-data-[variant=pill]/tabs:data-[state=active]:bg-surface-3 group-data-[variant=pill]/tabs:data-[state=active]:text-fg group-data-[variant=pill]/tabs:data-[state=active]:shadow-elev-1",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 duration-200",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
