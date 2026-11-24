"use client";

import React, { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, KeyRound, Lock, Plus, RefreshCw, Search, SearchX, ShieldCheck, Trash2, Webhook, Ticket, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { Field, describedBy } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { RelativeTime } from "@/components/patterns/relative-time";
import { CopyIcon, useCopy } from "@/components/patterns/copy-button";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import type { SafeCredentialRecord } from "@/lib/services/credential-service";
import { createCredentialAction, deleteCredentialAction, rotateCredentialAction } from "@/lib/actions/credential-actions";
import { hasPermission, type MemberRole } from "@/lib/auth/rbac";
import { duration, ease } from "@/components/motion/presets";

interface CredentialsVaultClientProps {
  initialCredentials: SafeCredentialRecord[];
  role: MemberRole;
}

const TYPES = ["api_key", "bearer_token", "oauth_secret", "webhook_secret"] as const;
const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  api_key: KeyRound,
  bearer_token: Ticket,
  oauth_secret: Fingerprint,
  webhook_secret: Webhook,
};
const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** Normalises typed names toward UPPER_SNAKE_CASE as the user types. */
function normaliseName(value: string) {
  return value.toUpperCase().replace(/[\s-]+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

export function CredentialsVaultClient({ initialCredentials, role }: CredentialsVaultClientProps) {
  const t = useTranslations("vault");
  const tCommon = useTranslations("common");
  const [credentials, setCredentials] = useState<SafeCredentialRecord[]>(initialCredentials);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SafeCredentialRecord | null>(null);
  const [rotating, setRotating] = useState<SafeCredentialRecord | null>(null);
  const canCreate = hasPermission(role, "credential:create");
  const canDelete = hasPermission(role, "credential:delete");
  const canView = hasPermission(role, "credential:view");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return credentials.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      return !q || c.name.toLowerCase().includes(q);
    });
  }, [credentials, query, typeFilter]);

  const typeLabel = (type: string) => (TYPES.includes(type as (typeof TYPES)[number]) ? t(`types.${type}` as "types.api_key") : type);

  async function handleDelete(cred: SafeCredentialRecord) {
    const res = await deleteCredentialAction(cred.id);
    if (res.success) {
      setCredentials((prev) => prev.filter((c) => c.id !== cred.id));
      toast.success(t("deleted", { name: cred.name }));
    } else {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> {t("newCredential")}
            </Button>
          ) : null
        }
      />

      {!canView && (
        <p role="status" className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          {t("noAccess")}
        </p>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-elev-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-success">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-fg">{t("howItWorksTitle")}</p>
          <p className="text-pretty text-[13px] leading-5 text-fg-muted">
            {t.rich("howItWorks", {
              ref: "{{credentials.NAME}}",
              code: (chunks) => (
                <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-fg">{chunks}</code>
              ),
            })}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="h-8 pl-9 sm:text-[13px]"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-full sm:w-48 sm:text-[13px]" aria-label={t("typeFilter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("allTypes")}</SelectItem>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-fg-subtle sm:ml-auto">{t("count", { count: filtered.length })}</span>
        </div>

        <Card className="overflow-hidden">
          {credentials.length === 0 ? (
            <EmptyState
              icon={Lock}
              title={t("emptyTitle")}
              description={t("emptyHint")}
              actions={
                canCreate ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden /> {t("newCredential")}
                  </Button>
                ) : null
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={SearchX} title={t("noMatches")} />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {filtered.map((cred) => (
                  <motion.li
                    key={cred.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: duration.base, ease: ease.emphasized }}
                  >
                    <CredentialRow
                      cred={cred}
                      typeLabel={typeLabel(cred.type)}
                      onDelete={canDelete ? () => setPendingDelete(cred) : undefined}
                      onRotate={canCreate ? () => setRotating(cred) : undefined}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </section>

      <CreateCredentialDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(cred) => setCredentials((prev) => [cred, ...prev])}
      />

      <RotateCredentialDialog
        credential={rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        onRotated={(cred) => setCredentials((prev) => prev.map((c) => (c.id === cred.id ? cred : c)))}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        tone="danger"
        title={pendingDelete ? t("deleteTitle", { name: pendingDelete.name }) : ""}
        description={t("deleteDescription")}
        confirmText={pendingDelete?.name}
        confirmLabel={tCommon("delete")}
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
        }}
      />
    </div>
  );
}

function CredentialRow({
  cred,
  typeLabel,
  onDelete,
  onRotate,
}: {
  cred: SafeCredentialRecord;
  typeLabel: string;
  onDelete?: () => void;
  onRotate?: () => void;
}) {
  const t = useTranslations("vault");
  const { copied, copy } = useCopy();
  const ref = `{{credentials.${cred.name}}}`;
  const Icon = TYPE_ICON[cred.type] ?? KeyRound;

  return (
    <div className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-2/50 sm:px-5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-[13px] font-semibold text-fg">{cred.name}</span>
            <Badge variant="neutral">{typeLabel}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
            <span className="font-mono">{cred.maskedValue}</span>
            <span aria-hidden>·</span>
            <span>{t.rich("created", { time: () => <RelativeTime date={cred.createdAt} tooltip={false} /> })}</span>
            {cred.updatedAt && new Date(cred.updatedAt).getTime() - new Date(cred.createdAt).getTime() > 1000 && (
              <>
                <span aria-hidden>·</span>
                <span>{t.rich("rotated", { time: () => <RelativeTime date={cred.updatedAt} tooltip={false} /> })}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-12 md:pl-0">
        <Tooltip content={copied ? t("referenceCopied", { ref }) : t("copyReference")}>
          <button
            type="button"
            onClick={async () => {
              if (await copy(ref)) toast.success(t("referenceCopied", { ref }));
            }}
            aria-label={`${t("copyReference")}: ${ref}`}
            className="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 font-mono text-xs text-fg-muted shadow-elev-1 transition-colors hover:border-line-strong hover:text-fg pointer-coarse:h-10"
          >
            <span className="truncate">{ref}</span>
            <CopyIcon copied={copied} className="size-3.5 shrink-0" />
          </button>
        </Tooltip>
        {onRotate && (
          <Tooltip content={t("rotate")}>
            <Button variant="ghost" size="icon-sm" onClick={onRotate} aria-label={t("rotateNamed", { name: cred.name })}>
              <RefreshCw aria-hidden />
            </Button>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip content={t("delete")}>
            <Button variant="danger-ghost" size="icon-sm" onClick={onDelete} aria-label={t("deleteNamed", { name: cred.name })}>
              <Trash2 aria-hidden />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function CreateCredentialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (cred: SafeCredentialRecord) => void;
}) {
  const t = useTranslations("vault");
  const tCommon = useTranslations("common");
  const tUi = useTranslations("ui");
  const ids = { name: useId(), type: useId(), value: useId() };
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("api_key");
  const [value, setValue] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setValue("");
      setType("api_key");
      setShowSecret(false);
      setSubmitted(false);
    }
  }, [open]);

  const nameError = submitted && !NAME_PATTERN.test(name) ? t("form.nameError") : undefined;
  const valueError = submitted && !value.trim() ? t("form.valueError") : undefined;
  const nameHint = t("form.nameHint", { ref: `{{credentials.${name || "NAME"}}}` });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!NAME_PATTERN.test(name) || !value.trim()) return;

    setIsCreating(true);
    try {
      const res = await createCredentialAction({ name, type, value });
      if (res.success && res.credential) {
        onCreated(res.credential);
        toast.success(t("form.created", { name: res.credential.name }));
        onOpenChange(false);
      } else {
        toast.error(res.error || t("form.failed"));
      }
    } catch {
      toast.error(t("form.failed"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isCreating && onOpenChange(o)}>
      <DialogContent size="md" closeLabel={tUi("close")}>
        <form onSubmit={handleCreate} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-fg-subtle" aria-hidden /> {t("form.title")}
            </DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field id={ids.name} label={t("form.name")} hint={nameHint} error={nameError}>
              <Input
                id={ids.name}
                value={name}
                onChange={(e) => setName(normaliseName(e.target.value))}
                placeholder="STRIPE_API_KEY"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-invalid={Boolean(nameError)}
                aria-describedby={describedBy(ids.name, { hint: nameHint, error: nameError })}
              />
            </Field>
            <Field id={ids.type} label={t("form.type")}>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id={ids.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`types.${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id={ids.value} label={t("form.value")} error={valueError}>
              <div className="relative">
                <Input
                  id={ids.value}
                  type={showSecret ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t("form.valuePlaceholder")}
                  className="pr-11 font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(valueError)}
                  aria-describedby={describedBy(ids.value, { error: valueError })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowSecret((s) => !s)}
                  aria-label={showSecret ? t("form.hide") : t("form.show")}
                  aria-pressed={showSecret}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  {showSecret ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isCreating}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isCreating}>
              {!isCreating && <Lock aria-hidden />} {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RotateCredentialDialog({
  credential,
  onOpenChange,
  onRotated,
}: {
  credential: SafeCredentialRecord | null;
  onOpenChange: (open: boolean) => void;
  onRotated: (cred: SafeCredentialRecord) => void;
}) {
  const t = useTranslations("vault");
  const tCommon = useTranslations("common");
  const valueId = useId();
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!credential) {
      setValue("");
      setVisible(false);
    }
  }, [credential]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!credential || !value.trim()) return;
    setBusy(true);
    try {
      const res = await rotateCredentialAction(credential.id, value);
      if (!res.success || !res.credential) {
        toast.error(res.error || t("rotateFailed"));
        return;
      }
      onRotated(res.credential);
      toast.success(t("rotatedToast", { name: credential.name }));
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={credential !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("rotateTitle", { name: credential?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("rotateDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field id={valueId} label={t("newValue")}>
              <div className="relative">
                <Input
                  id={valueId}
                  type={visible ? "text" : "password"}
                  autoComplete="off"
                  className="pr-10 font-mono"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? t("hideValue") : t("showValue")}
                  aria-pressed={visible}
                >
                  {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={busy} disabled={!value.trim()}>
              <RefreshCw aria-hidden /> {t("rotate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
