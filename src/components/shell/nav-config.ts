import { Activity, KeyRound, Settings, Workflow } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", key: "workflows", icon: Workflow },
  { href: "/executions", key: "executions", icon: Activity },
  { href: "/credentials", key: "vault", icon: KeyRound },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const SIDEBAR_COOKIE = "nf-sidebar";
