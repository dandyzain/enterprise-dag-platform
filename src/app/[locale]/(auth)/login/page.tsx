import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { BrandPanel } from "./brand-panel";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NexusLogo } from "@/components/brand/logo";
import { Link } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("nav");

  return (
    <div className="grid min-h-dvh bg-app lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="relative flex min-h-dvh flex-col">
        {/* Mobile-only ambient glow (brand panel is hidden below lg) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80 blur-3xl lg:hidden"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 0%, color-mix(in oklab, var(--signal-2) 18%, transparent), transparent)",
          }}
        />
        <header className="pt-safe relative flex h-16 items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label={t("home")} className="rounded-lg lg:invisible">
            <NexusLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher compact />
          </div>
        </header>
        <main className="relative flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
          <React.Suspense fallback={null}>
            <LoginForm />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
