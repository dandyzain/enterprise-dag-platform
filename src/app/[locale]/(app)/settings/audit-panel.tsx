"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ScrollText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { EmptyState } from "@/components/patterns/empty-state";
import { RelativeTime } from "@/components/patterns/relative-time";

export interface AuditItem {
  id: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function describeMetadata(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export function AuditPanel({ entries }: { entries: AuditItem[] }) {
  const t = useTranslations("settingsPage.audit");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.action, e.actorEmail, e.targetId, describeMetadata(e.metadata)].some((v) => v?.toLowerCase().includes(q))
    );
  }, [entries, query]);

  const label = (action: string) => (t.has(`actions.${action.replace(".", "_")}`) ? t(`actions.${action.replace(".", "_")}`) : action);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("hint")}</CardDescription>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-8 pl-9 sm:text-[13px]"
          />
        </div>
      </CardHeader>
      {filtered.length === 0 ? (
        <EmptyState compact icon={ScrollText} title={t("empty")} />
      ) : (
        <ol className="divide-y divide-line">
          {filtered.map((e) => {
            const meta = describeMetadata(e.metadata);
            return (
              <li key={e.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">
                    <span className="font-medium">{e.actorEmail ?? t("system")}</span>{" "}
                    <span className="text-fg-muted">{label(e.action)}</span>
                    {e.targetId && <span className="ml-1 font-mono text-xs text-fg-subtle">{e.targetId}</span>}
                  </p>
                  {meta && <p className="truncate text-xs text-fg-subtle">{meta}</p>}
                </div>
                <span className="text-xs text-fg-subtle">
                  <RelativeTime date={e.createdAt} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
