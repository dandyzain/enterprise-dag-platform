"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(newLocale: string) {
    if (newLocale === currentLocale) return;
    router.replace(pathname, { locale: newLocale as "en" | "id" });
  }

  return (
    <DropdownMenu>
      <Tooltip content={t("language")}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={compact ? "icon-sm" : "sm"}
            className={cn("text-fg-muted", !compact && "gap-1.5 px-2", className)}
            aria-label={`${t("language")}: ${currentLocale === "id" ? t("indonesian") : t("english")}`}
          >
            <Globe aria-hidden />
            {!compact && <span className="font-mono text-xs uppercase tracking-wide">{currentLocale}</span>}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentLocale} onValueChange={handleLocaleChange}>
          <DropdownMenuRadioItem value="en" lang="en">
            {t("english")}
            <span className="ml-auto font-mono text-2xs text-fg-subtle">EN</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="id" lang="id">
            {t("indonesian")}
            <span className="ml-auto font-mono text-2xs text-fg-subtle">ID</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
