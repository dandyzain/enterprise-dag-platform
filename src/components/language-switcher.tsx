"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(newLocale: "en" | "id") {
    if (newLocale === currentLocale) return;
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100"
          aria-label={t("language")}
        >
          <Globe className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-medium uppercase tracking-wider text-[11px]">
            {currentLocale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 border-zinc-800 bg-zinc-900">
        <DropdownMenuItem
          onClick={() => handleLocaleChange("en")}
          className="flex items-center justify-between text-xs py-2 hover:bg-zinc-800 focus:bg-zinc-800"
        >
          <span className="flex items-center gap-2">
            <span className="text-zinc-400 font-mono text-[11px]">EN</span>
            <span>{t("english")}</span>
          </span>
          {currentLocale === "en" && (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLocaleChange("id")}
          className="flex items-center justify-between text-xs py-2 hover:bg-zinc-800 focus:bg-zinc-800"
        >
          <span className="flex items-center gap-2">
            <span className="text-zinc-400 font-mono text-[11px]">ID</span>
            <span>{t("indonesian")}</span>
          </span>
          {currentLocale === "id" && (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
