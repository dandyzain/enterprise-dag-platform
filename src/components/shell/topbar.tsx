"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { NexusLogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserNav } from "@/components/auth/user-nav";
import type { SessionUser } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./shell-context";

function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function useIsMac() {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

export function Topbar({ session }: { session: SessionUser | null }) {
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const { setCommandOpen, setNewWorkflowOpen } = useShell();
  const scrolled = useScrolled();
  const isMac = useIsMac();

  return (
    <header
      className={cn(
        "pt-safe sticky top-0 z-20 border-b transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled ? "border-line bg-app/80 backdrop-blur-xl" : "border-transparent bg-app"
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile brand */}
        <Link href="/" aria-label={tNav("home")} className="group flex items-center gap-2 md:hidden">
          <NexusLogoMark size={26} animated />
          <span className="text-[15px] font-semibold tracking-tight text-fg">
            NexusFlow
          </span>
        </Link>

        {/* Search trigger (md+) */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className={cn(
            "hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm text-fg-subtle shadow-elev-1 md:flex",
            "transition-colors hover:border-line-strong hover:text-fg-muted"
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">{t("search")}</span>
          <span className="flex items-center gap-0.5" aria-hidden>
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("searchShort")} onClick={() => setCommandOpen(true)}>
            <Search aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={tNav("newWorkflow")}
            onClick={() => setNewWorkflowOpen(true)}
          >
            <Plus aria-hidden />
          </Button>
          <ThemeToggle />
          <LanguageSwitcher compact />
          <div className="ml-1 md:hidden">
            <UserNav session={session} variant="compact" />
          </div>
        </div>
      </div>
    </header>
  );
}
