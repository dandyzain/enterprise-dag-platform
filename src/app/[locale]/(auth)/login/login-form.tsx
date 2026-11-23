"use client";

import React, { useEffect, useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, describedBy } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginAction, registerAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function IconInput({
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <Input className={cn("h-10 pl-9", className)} {...props} />
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  describedById,
  autoComplete,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedById?: string;
  autoComplete: string;
  minLength?: number;
}) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const capsId = `${id}-caps`;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <Input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
          placeholder="••••••••••••"
          autoComplete={autoComplete}
          minLength={minLength}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={[describedById, capsLock ? capsId : null].filter(Boolean).join(" ") || undefined}
          className="h-10 pl-9 pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      {capsLock && (
        <p id={capsId} role="status" className="text-xs text-warning">
          {t("capsLock")}
        </p>
      )}
    </div>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("auth");
  const ids = {
    loginEmail: useId(),
    loginPassword: useId(),
    regName: useId(),
    regEmail: useId(),
    regWorkspace: useId(),
    regPassword: useId(),
  };

  const [mode, setMode] = useState<"login" | "register">(searchParams.get("mode") === "register" ? "register" : "login");
  const [isPending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  // Login form state (demo credentials prefilled, as before)
  const [loginEmail, setLoginEmail] = useState("admin@enterprise.io");
  const [loginPassword, setLoginPassword] = useState("Password123!");

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerWorkspace, setRegisterWorkspace] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSubmitted, setRegisterSubmitted] = useState(false);

  useEffect(() => {
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams]);

  const busy = isPending || redirecting;

  function setDemoCredentials(e: string, p: string) {
    setLoginEmail(e);
    setLoginPassword(p);
    toast.info(t("demoFilled", { email: e }));
  }

  function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("email", loginEmail);
    formData.append("password", loginPassword);

    startTransition(async () => {
      try {
        const res = await loginAction(formData);
        if (res.success && res.session) {
          setRedirecting(true);
          toast.success(t("welcomeBack", { name: res.session.name }));
          window.location.href = `/${locale}`;
        } else {
          toast.error(res.error || t("authFailed"));
        }
      } catch {
        toast.error(t("networkError"));
      }
    });
  }

  const regErrors = {
    name: registerSubmitted && !registerName.trim() ? t("nameRequired") : undefined,
    email: registerSubmitted && !EMAIL_PATTERN.test(registerEmail.trim()) ? t("emailInvalid") : undefined,
    password: registerSubmitted && registerPassword.length < 8 ? t("passwordTooShort") : undefined,
  };

  function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRegisterSubmitted(true);
    if (!registerName.trim() || !EMAIL_PATTERN.test(registerEmail.trim()) || registerPassword.length < 8) {
      return;
    }

    const formData = new FormData();
    formData.append("name", registerName.trim());
    formData.append("email", registerEmail.trim());
    formData.append("workspaceName", registerWorkspace.trim() || "My Team Workspace");
    formData.append("password", registerPassword);

    startTransition(async () => {
      try {
        const res = await registerAction(formData);
        if (res.success && res.session) {
          setRedirecting(true);
          toast.success(t("accountCreated", { workspace: res.session.workspaceName }));
          window.location.href = `/${locale}`;
        } else {
          toast.error(res.error || t("authFailed"));
        }
      } catch {
        toast.error(t("networkError"));
      }
    });
  }

  const demoAccounts = [
    { email: "admin@enterprise.io", label: t("demo.owner"), icon: ShieldCheck },
    { email: "editor@enterprise.io", label: t("demo.editor"), icon: Sparkles },
    { email: "viewer@enterprise.io", label: t("demo.viewer"), icon: Lock },
  ];

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-7 space-y-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-fg">
          {mode === "login" ? t("signInTitle") : t("registerTitle")}
        </h1>
        <p className="text-pretty text-sm leading-6 text-fg-muted">
          {mode === "login" ? t("signInSubtitle") : t("registerSubtitle")}
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
        <TabsList variant="pill" className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("signInTab")}</TabsTrigger>
          <TabsTrigger value="register">{t("registerTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLoginSubmit} className="space-y-4" aria-busy={busy}>
            <Field id={ids.loginEmail} label={t("workEmail")}>
              <IconInput
                icon={Mail}
                id={ids.loginEmail}
                name="email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                required
              />
            </Field>
            <Field id={ids.loginPassword} label={t("password")}>
              <PasswordInput
                id={ids.loginPassword}
                value={loginPassword}
                onChange={setLoginPassword}
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {busy ? (redirecting ? t("redirecting") : t("authenticating")) : t("signInButton")}
              {!busy && <ArrowRight aria-hidden />}
            </Button>

            <div className="space-y-3 pt-3">
              <div className="flex items-center gap-3 text-xs text-fg-subtle">
                <span className="h-px flex-1 bg-line" />
                {t("quickDemoAccounts")}
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map(({ email, label, icon: Icon }) => {
                  const active = loginEmail === email;
                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setDemoCredentials(email, "Password123!")}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-all duration-150 ease-standard active:scale-[0.97]",
                        active
                          ? "border-accent/40 bg-accent/10 text-fg"
                          : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg"
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-accent" : "text-fg-subtle")} aria-hidden />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="pt-2 text-center text-[13px] text-fg-muted">
              {t("noAccountPrompt")}{" "}
              <button type="button" onClick={() => setMode("register")} className="font-medium text-accent underline-offset-4 hover:underline">
                {t("createOne")}
              </button>
            </p>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate aria-busy={busy}>
            <Field id={ids.regName} label={t("fullName")} error={regErrors.name}>
              <IconInput
                icon={User}
                id={ids.regName}
                name="name"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                autoComplete="name"
                aria-invalid={Boolean(regErrors.name) || undefined}
                aria-describedby={describedBy(ids.regName, { error: regErrors.name })}
              />
            </Field>
            <Field id={ids.regEmail} label={t("workEmail")} error={regErrors.email}>
              <IconInput
                icon={Mail}
                id={ids.regEmail}
                name="email"
                type="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                aria-invalid={Boolean(regErrors.email) || undefined}
                aria-describedby={describedBy(ids.regEmail, { error: regErrors.email })}
              />
            </Field>
            <Field id={ids.regWorkspace} label={t("workspaceName")}>
              <IconInput
                icon={Building2}
                id={ids.regWorkspace}
                name="workspaceName"
                value={registerWorkspace}
                onChange={(e) => setRegisterWorkspace(e.target.value)}
                placeholder={t("workspacePlaceholder")}
                autoComplete="organization"
              />
            </Field>
            <Field
              id={ids.regPassword}
              label={t("password")}
              hint={t("passwordMinChars")}
              error={regErrors.password}
            >
              <PasswordInput
                id={ids.regPassword}
                value={registerPassword}
                onChange={setRegisterPassword}
                autoComplete="new-password"
                minLength={8}
                invalid={Boolean(regErrors.password)}
                describedById={describedBy(ids.regPassword, { hint: t("passwordMinChars"), error: regErrors.password })}
              />
            </Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div className="text-[13px]">
                <p className="font-medium text-fg">{t("freeTier")}</p>
                <p className="text-fg-muted">{t("freeTierHint")}</p>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {busy ? (redirecting ? t("redirecting") : t("creatingAccount")) : t("registerButton")}
              {!busy && <ArrowRight aria-hidden />}
            </Button>

            <p className="pt-2 text-center text-[13px] text-fg-muted">
              {t("hasAccountPrompt")}{" "}
              <button type="button" onClick={() => setMode("login")} className="font-medium text-accent underline-offset-4 hover:underline">
                {t("signInHere")}
              </button>
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
