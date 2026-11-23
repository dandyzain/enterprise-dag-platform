"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Building2, ChevronsUpDown, LogIn, LogOut, Settings, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/services/auth-service";
import { Link } from "@/i18n/routing";
import { cn, getInitials, splitNameTitle } from "@/lib/utils";
import { DEMO_PERSONAS, useAccountActions, type DemoEmail } from "@/components/shell/use-account-actions";
import { useAccount } from "@/components/shell/account-context";

interface UserNavProps {
  session: SessionUser | null;
  /** "compact" = avatar button (top bars); "sidebar" = full row. */
  variant?: "compact" | "sidebar";
  collapsed?: boolean;
  align?: "start" | "end";
  side?: "top" | "bottom" | "right";
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-signal text-xs font-semibold text-white shadow-elev-1",
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}

export function UserNav({ session, variant = "compact", collapsed = false, align = "end", side = "bottom" }: UserNavProps) {
  const t = useTranslations("account");
  const { isPending, switchRole, switchWorkspace, signOut } = useAccountActions();
  const { demoMode, workspaces } = useAccount();

  if (!session) {
    if (variant === "sidebar" && collapsed) {
      return (
        <Button asChild variant="ghost" size="icon" aria-label={t("signIn")} className="mx-auto">
          <Link href="/login">
            <LogIn aria-hidden />
          </Link>
        </Button>
      );
    }
    return (
      <div className={cn("flex items-center gap-2", variant === "sidebar" && "flex-col items-stretch")}>
        <Button asChild variant="secondary" size="sm">
          <Link href="/login">
            <LogIn aria-hidden /> {t("signIn")}
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/login?mode=register">
            <UserPlus aria-hidden /> {t("register")}
          </Link>
        </Button>
      </div>
    );
  }

  const { name, title } = splitNameTitle(session.name);
  const activePersona = DEMO_PERSONAS.find((p) => p.email === session.email)?.email ?? "";
  const showRoleTester = demoMode && activePersona !== "";

  const trigger =
    variant === "sidebar" ? (
      <button
        type="button"
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2",
          collapsed && "justify-center"
        )}
      >
        <span className="sr-only">{t("menu")}: </span>
        {collapsed && <span className="sr-only">{name}</span>}
        <Avatar name={session.name} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
              <span className="block truncate text-xs text-fg-subtle">{session.workspaceName}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          </>
        )}
      </button>
    ) : (
      <button
        type="button"
        className="rounded-lg transition-transform active:scale-95 data-[state=open]:ring-2 data-[state=open]:ring-ring/40"
      >
        <span className="sr-only">
          {t("menu")}: {name}
        </span>
        <Avatar name={session.name} />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-72">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={session.name} className="size-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{name}</p>
            <p className="truncate text-xs text-fg-subtle">{title ?? session.email}</p>
            {title ? <p className="truncate text-xs text-fg-subtle">{session.email}</p> : null}
          </div>
        </div>
        <div className="mx-2.5 mb-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-xs">
          <Building2 className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-fg-muted">{session.workspaceName}</span>
          <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 font-mono text-2xs font-medium text-fg-muted">
            {session.workspaceTier}
          </span>
        </div>
        {workspaces.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden /> {t("switchWorkspace")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={session.workspaceId} onValueChange={(v) => v !== session.workspaceId && switchWorkspace(v)}>
              {workspaces.map((w) => (
                <DropdownMenuRadioItem key={w.id} value={w.id} disabled={isPending}>
                  <span className="truncate">{w.name}</span>
                  <span className="ml-auto shrink-0 pl-3 text-xs text-fg-subtle">{t(`roles.${w.role}`)}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {showRoleTester && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden /> {t("roleTester")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={activePersona} onValueChange={(v) => switchRole(v as DemoEmail)}>
              {DEMO_PERSONAS.map((p) => (
                <DropdownMenuRadioItem key={p.email} value={p.email} disabled={isPending}>
                  {t(`roles.${p.role}`)}
                  <span className="ml-auto truncate pl-3 text-xs text-fg-subtle">{p.email.split("@")[0]}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden /> {t("workspaceSettings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/login">
            <LogIn aria-hidden /> {t("switchAccount")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem tone="danger" onSelect={signOut} disabled={isPending}>
          <LogOut aria-hidden /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
