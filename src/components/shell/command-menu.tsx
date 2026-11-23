"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Globe, LogOut, Monitor, Moon, Plus, Sun, UserCog, Workflow as WorkflowIcon } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/misc";
import type { SessionUser } from "@/lib/services/auth-service";
import { NAV_ITEMS } from "./nav-config";
import { useShell } from "./shell-context";
import { DEMO_PERSONAS, useAccountActions } from "./use-account-actions";

export interface CommandWorkflow {
  id: string;
  name: string;
  status: string;
}

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

export function CommandMenu({ session, workflows }: { session: SessionUser | null; workflows: CommandWorkflow[] }) {
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const { commandOpen, setCommandOpen, setNewWorkflowOpen } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { setTheme } = useTheme();
  const { switchRole, signOut } = useAccountActions();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      } else if (e.key === "/" && !commandOpen && !isTypingTarget(e.target)) {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  function run(fn: () => void) {
    setCommandOpen(false);
    // Let the dialog close (and restore focus) before navigating / opening another overlay.
    requestAnimationFrame(fn);
  }

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      title={t("commandTitle")}
      description={t("commandDescription")}
    >
      <CommandInput placeholder={t("commandPlaceholder")} trailing={<Kbd className="hidden sm:inline-flex">Esc</Kbd>} />
      <CommandList>
        <CommandEmpty>{t("commandEmpty")}</CommandEmpty>

        <CommandGroup heading={t("groups.navigation")}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} value={`nav ${tNav(item.key)}`} onSelect={() => run(() => router.push(item.href))}>
                <Icon aria-hidden />
                {tNav(item.key)}
              </CommandItem>
            );
          })}
          <CommandItem value={`new ${tNav("newWorkflow")}`} onSelect={() => run(() => setNewWorkflowOpen(true))}>
            <Plus aria-hidden />
            {tNav("newWorkflow")}
          </CommandItem>
        </CommandGroup>

        {workflows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("groups.workflows")}>
              {workflows.slice(0, 12).map((wf) => (
                <CommandItem
                  key={wf.id}
                  value={`workflow ${wf.name} ${wf.id}`}
                  onSelect={() => run(() => router.push(`/workflows/${wf.id}`))}
                >
                  <WorkflowIcon aria-hidden />
                  <span className="truncate">{wf.name}</span>
                  <CommandShortcut>{tStatus(wf.status as "DRAFT")}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading={t("groups.preferences")}>
          <CommandItem value={`theme ${t("themeLight")}`} onSelect={() => run(() => setTheme("light"))}>
            <Sun aria-hidden /> {tCommon("theme")}: {t("themeLight")}
          </CommandItem>
          <CommandItem value={`theme ${t("themeDark")}`} onSelect={() => run(() => setTheme("dark"))}>
            <Moon aria-hidden /> {tCommon("theme")}: {t("themeDark")}
          </CommandItem>
          <CommandItem value={`theme ${t("themeSystem")}`} onSelect={() => run(() => setTheme("system"))}>
            <Monitor aria-hidden /> {tCommon("theme")}: {t("themeSystem")}
          </CommandItem>
          {(["en", "id"] as const)
            .filter((l) => l !== locale)
            .map((l) => (
              <CommandItem
                key={l}
                value={`language ${l}`}
                onSelect={() => run(() => router.replace(pathname, { locale: l }))}
              >
                <Globe aria-hidden />
                {t("switchLanguage", { language: l === "en" ? tCommon("english") : tCommon("indonesian") })}
              </CommandItem>
            ))}
        </CommandGroup>

        {session && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("groups.account")}>
              {DEMO_PERSONAS.filter((p) => p.email !== session.email).map((p) => (
                <CommandItem key={p.email} value={`role ${p.role} ${p.email}`} onSelect={() => run(() => switchRole(p.email))}>
                  <UserCog aria-hidden />
                  {t("switchRole", { role: tAccount(`roles.${p.role}`) })}
                </CommandItem>
              ))}
              <CommandItem value={`sign out ${tAccount("signOut")}`} onSelect={() => run(signOut)}>
                <LogOut aria-hidden />
                {tAccount("signOut")}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
