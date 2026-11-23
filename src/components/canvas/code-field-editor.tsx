"use client";

import React, { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export interface VariableSuggestion {
  label: string;
  detail?: string;
}

const theme = EditorView.theme({
  "&": {
    fontSize: "12.5px",
    backgroundColor: "var(--surface)",
    color: "var(--fg)",
    borderRadius: "10px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 12px" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--accent) 22%, transparent) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in oklab, var(--accent) 18%, transparent)", outline: "none" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--failed)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip": {
    border: "1px solid var(--line)",
    backgroundColor: "var(--overlay)",
    color: "var(--fg)",
    borderRadius: "10px",
    boxShadow: "var(--elev-3)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", fontSize: "12px", maxHeight: "220px" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "6px 10px !important" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--surface-3)", color: "var(--fg)" },
  ".cm-completionDetail": { color: "var(--fg-subtle)", fontStyle: "normal", marginLeft: "12px" },
  ".cm-completionIcon": { display: "none" },
  ".cm-diagnostic": { fontFamily: "var(--font-sans)", fontSize: "12px", padding: "6px 10px" },
  ".cm-diagnostic-error": { borderLeft: "3px solid var(--failed)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--fg)" },
  { tag: tags.string, color: "var(--code-string)" },
  { tag: tags.number, color: "var(--code-number)" },
  { tag: [tags.bool, tags.null], color: "var(--code-literal)" },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: "var(--fg-subtle)" },
]);

function variableSource(vars: VariableSuggestion[]) {
  return (ctx: CompletionContext) => {
    const word = ctx.matchBefore(/\{\{[\w.$-]*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const options: Completion[] = vars.map((v) => ({
      label: v.label,
      detail: v.detail,
      type: "variable",
      apply: (view, _completion, from, to) => {
        // Swallow auto-closed braces so we never end up with "}}}}".
        const after = view.state.doc.sliceString(to, to + 2);
        const end = after === "}}" ? to + 2 : after.startsWith("}") ? to + 1 : to;
        view.dispatch({
          changes: { from, to: end, insert: v.label },
          selection: { anchor: from + v.label.length },
        });
      },
    }));
    return { from: word.from, options, validFor: /^\{\{[\w.$-]*$/ };
  };
}

interface CodeFieldEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  variables: VariableSuggestion[];
  minHeight: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  readOnly?: boolean;
}

export default function CodeFieldEditor({
  id,
  value,
  onChange,
  variables,
  minHeight,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  readOnly,
}: CodeFieldEditorProps) {
  const extensions = useMemo(
    () => [
      json(),
      linter(jsonParseLinter(), { delay: 400 }),
      autocompletion({ override: [variableSource(variables)], activateOnTyping: true, icons: false }),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      }),
      theme,
    ],
    [variables, id, ariaLabel, ariaDescribedBy, invalid]
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      readOnly={readOnly}
      minHeight={minHeight}
      maxHeight="320px"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: false,
        searchKeymap: false,
      }}
    />
  );
}
