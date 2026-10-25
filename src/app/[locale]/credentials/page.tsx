import React from "react";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, KeyRound, Lock, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { listCredentialsAction } from "@/lib/actions/credential-actions";
import { getCurrentSession } from "@/lib/services/auth-service";
import { UserNav } from "@/components/auth/user-nav";
import { CredentialsVaultClient } from "./credentials-client";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function CredentialsPage() {
  const t = await getTranslations("common");
  const session = await getCurrentSession();
  const credentials = await listCredentialsAction();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-zinc-800 shrink-0 hidden sm:block" />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span className="truncate">Security & Credentials Vault</span>
              <span className="text-[10px] font-mono bg-zinc-800 text-emerald-400 border border-zinc-700 px-1.5 py-0.5 rounded shrink-0">
                AES-256-GCM
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              Zero-knowledge encrypted storage for API keys and bearer tokens
            </p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl text-xs font-medium">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Workflows
          </Link>
          <Link
            href="/executions"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Executions
          </Link>
          <Link
            href="/credentials"
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-100 font-semibold"
          >
            Vault & Keys
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
          >
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LanguageSwitcher />
          <UserNav session={session} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Mobile Navigation Tabs (visible only on small viewports) */}
        <div className="flex md:hidden items-center gap-1 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl text-xs font-medium">
          <Link
            href="/"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Workflows
          </Link>
          <Link
            href="/executions"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Executions
          </Link>
          <Link
            href="/credentials"
            className="flex-1 text-center py-2 rounded-lg bg-zinc-800 text-zinc-100 font-semibold shadow-sm"
          >
            Vault
          </Link>
          <Link
            href="/settings"
            className="flex-1 text-center py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Settings
          </Link>
        </div>

        <CredentialsVaultClient initialCredentials={credentials} />
      </main>
    </div>
  );
}
