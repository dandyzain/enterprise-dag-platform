"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Monitor, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileWarningBanner() {
  const t = useTranslations("workflow.canvas");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="md:hidden fixed bottom-4 left-4 right-4 z-20 rounded-xl border border-amber-500/30 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-400">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-100">
              Desktop View Recommended
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-400 leading-relaxed">
              {t("mobileNotice")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 text-zinc-400 hover:text-zinc-100 -mr-1 -mt-1"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
