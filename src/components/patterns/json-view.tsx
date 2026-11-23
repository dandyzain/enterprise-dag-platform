"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Tokenises JSON text into React nodes (no innerHTML). */
function highlight(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [full, str, colon, literal, num] = match;
    if (str) {
      out.push(
        <span key={i++} className={colon ? "text-fg" : "text-code-string"}>
          {str}
        </span>
      );
      if (colon) out.push(colon);
    } else if (literal) {
      out.push(
        <span key={i++} className="text-code-literal">
          {literal}
        </span>
      );
    } else if (num) {
      out.push(
        <span key={i++} className="text-code-number">
          {num}
        </span>
      );
    } else {
      out.push(full);
    }
    last = match.index + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface JsonViewProps {
  value: unknown;
  className?: string;
  maxHeight?: string;
  copyLabel?: string;
}

export function JsonView({ value, className, maxHeight = "max-h-64", copyLabel }: JsonViewProps) {
  const text = React.useMemo(() => {
    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2) ?? "null";
  }, [value]);

  return (
    <div className={cn("group/json relative rounded-lg border border-line bg-surface-2", className)}>
      <pre
        tabIndex={0}
        className={cn(
          "overflow-auto p-3 pr-10 font-mono text-xs leading-5 text-fg-muted",
          maxHeight
        )}
      >
        <code>{highlight(text)}</code>
      </pre>
      <div className="absolute right-1.5 top-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/json:opacity-100 md:group-focus-within/json:opacity-100">
        <CopyButton value={text} label={copyLabel} />
      </div>
    </div>
  );
}
