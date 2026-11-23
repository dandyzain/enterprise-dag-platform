"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { VariableSuggestion } from "./code-field-editor";

// CodeMirror is code-split: only loaded when a JSON field is on screen.
const CodeFieldEditor = dynamic(() => import("./code-field-editor"), {
  ssr: false,
  loading: () => <div className="skeleton h-24 rounded-[10px]" aria-hidden />,
});

export type { VariableSuggestion };

function toText(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? {}, null, 2);
}

interface CodeFieldProps {
  id: string;
  /** Stored config value: an object (valid JSON) or raw text (invalid JSON). */
  value: unknown;
  /** Emits the parsed object when the text is valid JSON, otherwise the raw text. */
  onChange: (value: unknown) => void;
  variables: VariableSuggestion[];
  minHeight?: string;
  ariaLabel?: string;
  readOnly?: boolean;
}

/**
 * JSON editor field. Keeps its own text so formatting/cursor never jump while
 * typing; valid JSON is stored as an object (matching the config schema),
 * invalid JSON is kept as text until fixed.
 */
export function CodeField({ id, value, onChange, variables, minHeight = "96px", ariaLabel, readOnly }: CodeFieldProps) {
  const t = useTranslations("editor.inspector");
  const [text, setText] = React.useState(() => toText(value));
  const lastEmitted = React.useRef<string>(JSON.stringify(value ?? null));

  // Sync when the value changes from outside (undo/redo, template load).
  React.useEffect(() => {
    const incoming = JSON.stringify(value ?? null);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setText(toText(value));
    }
  }, [value]);

  const invalid = React.useMemo(() => {
    if (!text.trim()) return false;
    try {
      JSON.parse(text);
      return false;
    } catch {
      return true;
    }
  }, [text]);

  function handleChange(next: string) {
    setText(next);
    let out: unknown = next;
    try {
      out = JSON.parse(next);
    } catch {
      // keep raw text
    }
    lastEmitted.current = JSON.stringify(out ?? null);
    onChange(out);
  }

  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "rounded-[10px] border bg-surface shadow-elev-1 transition-[border-color,box-shadow] focus-within:ring-3",
          invalid
            ? "border-failed focus-within:ring-failed/20"
            : "border-line hover:border-line-strong focus-within:border-accent focus-within:ring-accent/20"
        )}
      >
        <CodeFieldEditor
          id={id}
          value={text}
          onChange={handleChange}
          variables={variables}
          minHeight={minHeight}
          ariaLabel={ariaLabel}
          ariaDescribedBy={invalid ? errorId : undefined}
          invalid={invalid}
          readOnly={readOnly}
        />
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="text-xs text-failed">
          {t("invalidJson")}
        </p>
      )}
    </div>
  );
}
