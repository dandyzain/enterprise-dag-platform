import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MailCheck, MailX } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { NexusLogo } from "@/components/brand/logo";
import { getCurrentSession } from "@/lib/services/auth-service";
import { previewInvitation } from "@/lib/services/workspace-service";
import { AcceptInviteButton, SwitchAccountButton } from "./accept-button";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, tAccount, invite, session] = await Promise.all([
    getTranslations("invite"),
    getTranslations("account"),
    previewInvitation(token),
    getCurrentSession(),
  ]);

  const emailMatches = session && invite && session.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-5 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-elev-2 sm:p-8">
        <NexusLogo size="sm" />
        {!invite ? (
          <div className="space-y-3">
            <MailX className="size-8 text-failed" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight text-fg">{t("invalidTitle")}</h1>
            <p className="text-sm text-fg-muted">{t("invalidBody")}</p>
            <Button asChild variant="secondary">
              <Link href="/login">{t("goToLogin")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <MailCheck className="size-8 text-success" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              {t("title", { workspace: invite.workspaceName })}
            </h1>
            <p className="text-sm text-fg-muted">
              {t("body", { email: invite.email, role: tAccount(`roles.${invite.role}`) })}
            </p>
            {emailMatches ? (
              <AcceptInviteButton token={token} />
            ) : session ? (
              <div className="space-y-3">
                <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-fg">
                  {t("wrongAccount", { current: session.email, email: invite.email })}
                </p>
                <SwitchAccountButton token={token} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href={`/login?invite=${encodeURIComponent(token)}`}>{t("signInToAccept")}</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/login?mode=register&invite=${encodeURIComponent(token)}`}>{t("createAccount")}</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
