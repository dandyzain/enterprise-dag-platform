"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Fallback for insecure contexts.
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function useCopy(timeout = 1800) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = React.useCallback(
    async (value: string) => {
      const ok = await writeClipboard(value);
      if (ok) {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), timeout);
      }
      return ok;
    },
    [timeout]
  );
  return { copied, copy };
}

/** Icon that morphs Copy → Check. */
export function CopyIcon({ copied, className }: { copied: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-4 items-center justify-center", className)} aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex"
          >
            <Check className="size-full text-success" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex"
          >
            <Copy className="size-full" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "value"> {
  value: string;
  /** Accessible label, e.g. "Copy run ID". */
  label?: string;
  /** Toast message on success (omit for silent copy). */
  toastMessage?: string;
  showLabel?: boolean;
}

export function CopyButton({
  value,
  label,
  toastMessage,
  showLabel = false,
  size = "icon-xs",
  variant = "ghost",
  className,
  children,
  ...props
}: CopyButtonProps) {
  const t = useTranslations("ui");
  const { copied, copy } = useCopy();
  const accessible = label ?? t("copy");

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={showLabel || children ? undefined : accessible}
      className={className}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copy(value);
        if (ok && toastMessage) toast.success(toastMessage);
      }}
      {...props}
    >
      <CopyIcon copied={copied} />
      {children ?? (showLabel ? <span>{copied ? t("copied") : accessible}</span> : null)}
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </Button>
  );

  return showLabel || children ? button : <Tooltip content={copied ? t("copied") : accessible}>{button}</Tooltip>;
}
