"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Workflow,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  User,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, registerAction } from "@/lib/actions/auth-actions";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [isPending, startTransition] = useTransition();
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "verifying" | "signing" | "redirecting">("idle");
  const [actionType, setActionType] = useState<"login" | "register">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("admin@enterprise.io");
  const [loginPassword, setLoginPassword] = useState("Password123!");

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerWorkspace, setRegisterWorkspace] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  useEffect(() => {
    if (searchParams.get("mode") === "register") {
      setMode("register");
    }
  }, [searchParams]);

  function setDemoCredentials(e: string, p: string) {
    setLoginEmail(e);
    setLoginPassword(p);
    toast.info(`Filled demo credentials for ${e}`);
  }

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionType("login");
    setLoadingPhase("verifying");

    const formData = new FormData();
    formData.append("email", loginEmail);
    formData.append("password", loginPassword);

    startTransition(async () => {
      const timer1 = setTimeout(() => setLoadingPhase("signing"), 450);
      const timer2 = setTimeout(() => setLoadingPhase("redirecting"), 900);

      try {
        const [_, res] = await Promise.all([
          new Promise((r) => setTimeout(r, 1200)),
          loginAction(formData),
        ]);

        clearTimeout(timer1);
        clearTimeout(timer2);

        if (res.success && res.session) {
          setLoadingPhase("redirecting");
          toast.success(`Welcome back, ${res.session.name}!`);
          window.location.href = "/";
        } else {
          setLoadingPhase("idle");
          toast.error(res.error || "Authentication failed.");
        }
      } catch {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setLoadingPhase("idle");
        toast.error("Authentication failed. Please check your network connection.");
      }
    });
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!registerName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!registerEmail.trim()) {
      toast.error("Please enter a valid work email.");
      return;
    }
    if (registerPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setActionType("register");
    setLoadingPhase("verifying");

    const formData = new FormData();
    formData.append("name", registerName.trim());
    formData.append("email", registerEmail.trim());
    formData.append("workspaceName", registerWorkspace.trim() || "My Team Workspace");
    formData.append("password", registerPassword);

    startTransition(async () => {
      const timer1 = setTimeout(() => setLoadingPhase("signing"), 500);
      const timer2 = setTimeout(() => setLoadingPhase("redirecting"), 1000);

      try {
        const [_, res] = await Promise.all([
          new Promise((r) => setTimeout(r, 1300)),
          registerAction(formData),
        ]);

        clearTimeout(timer1);
        clearTimeout(timer2);

        if (res.success && res.session) {
          setLoadingPhase("redirecting");
          toast.success(`Account created successfully! Welcome to ${res.session.workspaceName}.`);
          window.location.href = "/";
        } else {
          setLoadingPhase("idle");
          toast.error(res.error || "Registration failed.");
        }
      } catch {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setLoadingPhase("idle");
        toast.error("Registration failed. Please try again.");
      }
    });
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-fade-in-up animate-shimmer relative overflow-hidden">
      {/* IMMERSIVE AUTHENTICATION LOADING OVERLAY */}
      {loadingPhase !== "idle" && (
        <div className="absolute inset-0 bg-zinc-950/92 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 z-30 animate-in fade-in duration-200">
          {/* Orbital Multi-Ring Animation */}
          <div className="relative flex items-center justify-center w-28 h-28 mb-5">
            {/* Outer dashed spinning ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/40 animate-spin-slow" />
            {/* Middle reverse gradient spinning ring */}
            <div className="absolute inset-2 rounded-full border-2 border-sky-400/30 border-t-emerald-400 border-r-transparent animate-spin-reverse" />
            {/* Center glowing badge */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              {actionType === "login" ? (
                <ShieldCheck className="h-7 w-7 text-emerald-400 animate-bounce-subtle drop-shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
              ) : (
                <Sparkles className="h-7 w-7 text-emerald-400 animate-bounce-subtle drop-shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
              )}
            </div>
            {/* Ping pulse aura */}
            <span className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping pointer-events-none" />
          </div>

          {/* Dynamic Status Text */}
          <div className="space-y-1.5 text-center max-w-xs">
            <div className="text-sm font-semibold text-zinc-100 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 radar-live-dot" />
              <span>
                {actionType === "login"
                  ? loadingPhase === "verifying"
                    ? t("authenticatingStep1")
                    : loadingPhase === "signing"
                    ? t("authenticatingStep2")
                    : t("authenticatingStep3")
                  : loadingPhase === "verifying"
                  ? t("registeringStep1")
                  : loadingPhase === "signing"
                  ? t("registeringStep2")
                  : t("redirecting")}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              {actionType === "login"
                ? "HMAC-SHA256 • Scrypt Key Derivation"
                : "AES-256-GCM Vault • Free Tier DAG Cluster"}
            </p>
          </div>

          {/* Infinite Glowing Progress Bar Track */}
          <div className="mt-5 w-48 h-1.5 bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800">
            <div className="animate-progress-infinite" />
          </div>
        </div>
      )}
      {/* Brand Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
          <Workflow className="h-6 w-6 animate-bounce-subtle" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          {mode === "login" ? t("signInTitle") : t("registerTitle")}
        </h1>
        <p className="text-xs text-zinc-400">
          {mode === "login" ? t("signInSubtitle") : t("registerSubtitle")}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex rounded-xl bg-zinc-900/80 p-1 border border-zinc-800 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 py-1.5 rounded-lg transition-all duration-200 text-center ${
            mode === "login"
              ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs scale-[1.02]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t("signInTab")}
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 py-1.5 rounded-lg transition-all duration-200 text-center ${
            mode === "register"
              ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs scale-[1.02]"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t("registerTab")}
        </button>
      </div>

      {/* LOGIN FORM */}
      {mode === "login" && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">
              {t("workEmail")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">
              {t("password")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2 h-9 text-xs"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("authenticating")}</span>
              </>
            ) : (
              <>
                <span>{t("signInButton")}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {/* Quick Demo Fill Presets */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider text-center">
              {t("quickDemoAccounts")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials("admin@enterprise.io", "Password123!")}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-300 text-[10px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] hover:shadow-md hover:shadow-emerald-950/50"
              >
                <ShieldCheck className="h-3.5 w-3.5 mb-1 text-emerald-400 animate-bounce-subtle" />
                <span>Owner / Admin</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials("editor@enterprise.io", "Password123!")}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-sky-500/30 bg-sky-950/20 hover:bg-sky-900/40 text-sky-300 text-[10px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] hover:shadow-md hover:shadow-sky-950/50"
              >
                <Sparkles className="h-3.5 w-3.5 mb-1 text-sky-400 animate-bounce-subtle" />
                <span>Editor / Member</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials("viewer@enterprise.io", "Password123!")}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/40 text-amber-300 text-[10px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] hover:shadow-md hover:shadow-amber-950/50"
              >
                <Lock className="h-3.5 w-3.5 mb-1 text-amber-400" />
                <span>Viewer Only</span>
              </button>
            </div>
          </div>

          <div className="text-center pt-1 text-xs text-zinc-400">
            <span>{t("noAccountPrompt")} </span>
            <button
              type="button"
              onClick={() => setMode("register")}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1"
            >
              {t("createOne")}
            </button>
          </div>
        </form>
      )}

      {/* REGISTER FORM */}
      {mode === "register" && (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">
              {t("fullName")}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="name"
                type="text"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                required
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">
              {t("workEmail")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="email"
                type="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">
              {t("workspaceName")}
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="workspaceName"
                type="text"
                value={registerWorkspace}
                onChange={(e) => setRegisterWorkspace(e.target.value)}
                placeholder={t("workspacePlaceholder")}
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300 block">
                {t("password")}
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">
                {t("passwordMinChars")}
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                name="password"
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-2.5 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Free Tier Workspace Included</span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Instant access to DAG graph engine, AES-256 encrypted Vault, and BullMQ worker queue.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2 h-9 text-xs"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("creatingAccount")}</span>
              </>
            ) : (
              <>
                <span>{t("registerButton")}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="text-center pt-1 text-xs text-zinc-400">
            <span>{t("hasAccountPrompt")} </span>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1"
            >
              {t("signInHere")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}