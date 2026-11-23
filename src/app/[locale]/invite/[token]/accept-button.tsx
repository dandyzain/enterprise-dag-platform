"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/lib/actions/auth-actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const [busy, setBusy] = React.useState(false);

  async function accept() {
    setBusy(true);
    try {
      const res = await acceptInvitationAction(token);
      if (!res.success) {
        toast.error(res.error || t("failed"));
        return;
      }
      toast.success(t("accepted"));
      window.location.href = `/${locale}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={accept} loading={busy}>
      {t("accept")}
    </Button>
  );
}

export function SwitchAccountButton({ token }: { token: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const [busy, setBusy] = React.useState(false);

  async function switchAccount() {
    setBusy(true);
    const { logoutAction } = await import("@/lib/actions/auth-actions");
    await logoutAction();
    window.location.href = `/${locale}/login?invite=${encodeURIComponent(token)}`;
  }

  return (
    <Button variant="secondary" onClick={switchAccount} loading={busy}>
      {t("switchAccount")}
    </Button>
  );
}
