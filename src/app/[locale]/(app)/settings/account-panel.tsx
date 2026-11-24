"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { changePasswordAction, signOutEverywhereAction, updateProfileAction } from "@/lib/actions/workspace-actions";
import type { SessionUser } from "@/lib/services/auth-service";

const MIN_PASSWORD = 8;

export function AccountPanel({ session, isDemoPersona }: { session: SessionUser; isDemoPersona: boolean }) {
  const t = useTranslations("settingsPage.accountTab");
  const locale = useLocale();
  const [name, setName] = React.useState(session.name);
  const [savingName, setSavingName] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [changing, setChanging] = React.useState(false);
  const [signOutOpen, setSignOutOpen] = React.useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await updateProfileAction(name);
      if (res.success) toast.success(t("profileSaved"));
      else toast.error(res.error || t("failed"));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch || tooShort || !current) return;
    setChanging(true);
    try {
      const res = await changePasswordAction(current, next);
      if (res.success) {
        toast.success(t("passwordChanged"));
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        toast.error(res.error || t("failed"));
      }
    } finally {
      setChanging(false);
    }
  }

  async function signOutEverywhere() {
    const res = await signOutEverywhereAction();
    if (res.success) window.location.href = `/${locale}/login`;
    else toast.error(res.error || t("failed"));
  }

  return (
    <div className="space-y-6">
      {isDemoPersona && (
        <p role="status" className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          {t("demoReadOnly")}
        </p>
      )}

      <Card className="p-5">
        <form onSubmit={saveName} className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <UserRound className="size-4 text-fg-subtle" aria-hidden /> {t("profileTitle")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="acct-name" label={t("name")}>
              <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isDemoPersona} maxLength={80} />
            </Field>
            <Field id="acct-email" label={t("email")}>
              <Input id="acct-email" value={session.email} disabled readOnly />
            </Field>
          </div>
          <Button type="submit" size="sm" loading={savingName} disabled={isDemoPersona || name.trim() === session.name}>
            {t("saveProfile")}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <KeyRound className="size-4 text-fg-subtle" aria-hidden /> {t("passwordTitle")}
            </h3>
            <p className="mt-1 text-[13px] text-fg-muted">{t("passwordHint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="acct-current" label={t("currentPassword")}>
              <Input
                id="acct-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={isDemoPersona}
              />
            </Field>
            <Field id="acct-new" label={t("newPassword")} error={tooShort ? t("tooShort", { min: MIN_PASSWORD }) : undefined}>
              <Input
                id="acct-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={isDemoPersona}
                aria-invalid={tooShort || undefined}
              />
            </Field>
            <Field id="acct-confirm" label={t("confirmPassword")} error={mismatch ? t("mismatch") : undefined}>
              <Input
                id="acct-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isDemoPersona}
                aria-invalid={mismatch || undefined}
              />
            </Field>
          </div>
          <Button
            type="submit"
            size="sm"
            loading={changing}
            disabled={isDemoPersona || !current || !next || mismatch || tooShort}
          >
            {t("changePassword")}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <LogOut className="size-4 text-fg-subtle" aria-hidden /> {t("sessionsTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-fg-muted">{t("sessionsHint")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setSignOutOpen(true)} disabled={isDemoPersona}>
          {t("signOutEverywhere")}
        </Button>
      </Card>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        tone="danger"
        title={t("signOutEverywhere")}
        description={t("signOutConfirm")}
        confirmLabel={t("signOutEverywhere")}
        onConfirm={signOutEverywhere}
      />
    </div>
  );
}
