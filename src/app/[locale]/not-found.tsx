import { getTranslations } from "next-intl/server";
import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { NexusLogo } from "@/components/brand/logo";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-app px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-[36rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--signal-2) 18%, transparent), transparent)",
        }}
      />
      <div className="relative space-y-6">
        <div className="flex justify-center">
          <NexusLogo size="md" />
        </div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted shadow-elev-1">
          <Compass className="size-5" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-sm text-fg-subtle">404</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("notFoundTitle")}</h1>
          <p className="mx-auto max-w-sm text-sm text-fg-muted">{t("notFoundBody")}</p>
        </div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft aria-hidden /> {t("goHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
