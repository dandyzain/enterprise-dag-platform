import React from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, Locale } from "@/i18n/routing";
import { Toaster } from "sonner";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "NexusFlow — Enterprise Visual Workflow DAG Platform",
  description: "Distributed Directed Acyclic Graph (DAG) Execution Engine with Hardware-grade Security, Anti-SSRF, and Real-time Telemetry",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen selection:bg-emerald-500/20 selection:text-emerald-300">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            richColors
            toastOptions={{
              className:
                "border border-zinc-800 bg-zinc-900/95 text-zinc-100 backdrop-blur-md shadow-2xl",
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
