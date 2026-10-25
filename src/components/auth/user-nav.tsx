"use client";

import React, { useTransition } from "react";
import {
  User,
  Shield,
  Building2,
  ChevronDown,
  LogOut,
  Sparkles,
  Check,
  Lock,
  Layers,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SessionUser } from "@/lib/services/auth-service";
import { switchDemoRoleAction, logoutAction } from "@/lib/actions/auth-actions";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

interface UserNavProps {
  session: SessionUser | null;
}

export function UserNav({ session }: UserNavProps) {
  const [isPending, startTransition] = useTransition();

  if (!session) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Link href="/login">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs h-8 px-2.5 sm:px-3 font-medium"
          >
            Sign In
          </Button>
        </Link>
        <Link href="/login?mode=register">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold text-xs h-8 px-2.5 sm:px-3"
          >
            Register
          </Button>
        </Link>
      </div>
    );
  }

  function handleSwitchDemoRole(email: "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io") {
    startTransition(async () => {
      try {
        const res = await switchDemoRoleAction(email);
        toast.success(`Switched role to ${res.session.role} (${res.session.name})`);
        window.location.reload();
      } catch {
        toast.error("Failed to switch role.");
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      toast.info("Signed out from workspace session.");
      window.location.href = "/login";
    });
  }

  const roleColor =
    session.role === "OWNER"
      ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30"
      : session.role === "ADMIN"
      ? "text-violet-400 bg-violet-950/40 border-violet-500/30"
      : session.role === "MEMBER"
      ? "text-sky-400 bg-sky-950/40 border-sky-500/30"
      : "text-amber-400 bg-amber-950/40 border-amber-500/30";

  const tierBadge =
    session.workspaceTier === "ENTERPRISE"
      ? "bg-violet-900/60 text-violet-200 border-violet-700"
      : session.workspaceTier === "PRO"
      ? "bg-emerald-900/60 text-emerald-200 border-emerald-700"
      : "bg-zinc-800 text-zinc-300 border-zinc-700";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1.5 hover:bg-zinc-850 hover:border-zinc-700 transition-colors text-left focus:outline-none shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 uppercase">
            {session.name.substring(0, 2)}
          </div>
          <div className="hidden xl:block min-w-0 pr-1">
            <div className="text-xs font-medium text-zinc-100 truncate max-w-[120px]">
              {session.name}
            </div>
            <div className="text-[10px] text-zinc-400 truncate max-w-[120px]">
              {session.workspaceName}
            </div>
          </div>
          <ChevronDown className="h-3 w-3 text-zinc-500 mr-0.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl">
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-100 truncate">{session.name}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${roleColor}`}>
                {session.role}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 truncate">{session.email}</span>
            <div className="flex items-center gap-1.5 pt-1">
              <Building2 className="h-3 w-3 text-zinc-500" />
              <span className="text-[11px] text-zinc-300 truncate">{session.workspaceName}</span>
              <span className={`ml-auto text-[9px] uppercase font-mono px-1.5 rounded border ${tierBadge}`}>
                {session.workspaceTier}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-zinc-800" />

        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Quick RBAC Role Tester
        </div>

        <DropdownMenuItem
          onClick={() => handleSwitchDemoRole("admin@enterprise.io")}
          disabled={isPending}
          className="flex items-center justify-between text-xs py-1.5 cursor-pointer text-zinc-200"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span>Admin / Owner</span>
          </div>
          {session.role === "OWNER" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSwitchDemoRole("editor@enterprise.io")}
          disabled={isPending}
          className="flex items-center justify-between text-xs py-1.5 cursor-pointer text-zinc-200"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span>Editor / Member</span>
          </div>
          {session.role === "MEMBER" && <Check className="h-3.5 w-3.5 text-sky-400" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSwitchDemoRole("viewer@enterprise.io")}
          disabled={isPending}
          className="flex items-center justify-between text-xs py-1.5 cursor-pointer text-zinc-200"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            <span>Viewer (Read-only)</span>
          </div>
          {session.role === "VIEWER" && <Check className="h-3.5 w-3.5 text-amber-400" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-zinc-800" />

        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-zinc-300"
          >
            <Settings className="h-3.5 w-3.5 text-zinc-400" />
            <span>Workspace & Plan Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-zinc-300"
          >
            <User className="h-3.5 w-3.5 text-zinc-400" />
            <span>Switch Account / Sign In</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isPending}
          className="flex items-center gap-2 text-xs py-1.5 cursor-pointer text-rose-400 hover:text-rose-300 focus:text-rose-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
