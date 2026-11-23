"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, X } from "lucide-react";

const KEY = "nf-canvas-mobile-tip";

/** One-time, dismissible tip on phones (replaces the old "desktop recommended" nag). */
export function MobileTip() {
  const t = useTranslations("editor.tip");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // per-viewer convenience only
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute inset-x-3 top-3 z-10 flex items-start gap-2.5 rounded-xl border border-line bg-overlay/95 p-3 shadow-elev-2 backdrop-blur md:hidden"
          role="note"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-[13px] leading-5 text-fg-muted">{t("mobile")}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("dismiss")}
            className="-m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
