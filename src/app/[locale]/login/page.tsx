import React from "react";
import { LoginForm } from "./login-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-emerald-500/10 via-violet-500/5 to-sky-500/10 rounded-full blur-3xl pointer-events-none animate-ambient-float" />

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <React.Suspense fallback={<div className="text-zinc-500 text-xs">Loading...</div>}>
          <LoginForm />
        </React.Suspense>
      </div>
    </div>
  );
}
