"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { duration, ease } from "@/components/motion/presets";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-line !bg-overlay !text-fg !shadow-elev-3 !font-sans",
          description: "!text-fg-muted",
          actionButton: "!bg-accent-solid !text-accent-solid-fg !font-medium",
          cancelButton: "!bg-surface-2 !text-fg",
          closeButton: "!bg-overlay !border-line !text-fg-muted hover:!text-fg",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-failed",
          info: "[&_[data-icon]]:!text-running",
          warning: "[&_[data-icon]]:!text-warning",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      themes={["light", "dark"]}
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user" transition={{ duration: duration.base, ease: ease.standard }}>
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
