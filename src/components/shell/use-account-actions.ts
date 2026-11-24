"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { switchDemoRoleAction, switchWorkspaceAction, logoutAction } from "@/lib/actions/auth-actions";

export type DemoEmail = "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io";

export const DEMO_PERSONAS: { email: DemoEmail; role: "OWNER" | "MEMBER" | "VIEWER" }[] = [
  { email: "admin@enterprise.io", role: "OWNER" },
  { email: "editor@enterprise.io", role: "MEMBER" },
  { email: "viewer@enterprise.io", role: "VIEWER" },
];

/** Shared demo-role switching + sign-out (same server actions as before). */
export function useAccountActions() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const t = useTranslations("account");

  function switchRole(email: DemoEmail) {
    startTransition(async () => {
      try {
        const res = await switchDemoRoleAction(email);
        if (!res.success || !res.session) {
          toast.error(res.error || t("roleSwitchFailed"));
          return;
        }
        toast.success(t("roleSwitched", { role: t(`roles.${res.session.role}`), name: res.session.name }));
        window.location.reload();
      } catch {
        toast.error(t("roleSwitchFailed"));
      }
    });
  }

  function switchWorkspace(workspaceId: string) {
    startTransition(async () => {
      const res = await switchWorkspaceAction(workspaceId);
      if (!res.success) {
        toast.error(res.error || t("workspaceSwitchFailed"));
        return;
      }
      window.location.href = `/${locale}`;
    });
  }

  function signOut() {
    startTransition(async () => {
      await logoutAction();
      toast.info(t("signedOut"));
      window.location.href = `/${locale}/login`;
    });
  }

  return { isPending, switchRole, switchWorkspace, signOut };
}
