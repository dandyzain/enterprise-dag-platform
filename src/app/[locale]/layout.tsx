import React from "react";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, Locale } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import "@/app/globals.css";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const DESCRIPTION =
  "Design, run and monitor distributed DAG workflows with live telemetry, an encrypted credential vault and role-based access control.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "NexusFlow — Visual Workflow Automation",
    template: "%s · NexusFlow",
  },
  description: DESCRIPTION,
  applicationName: "NexusFlow",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    type: "website",
    siteName: "NexusFlow",
    title: "NexusFlow — Visual Workflow Automation",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "NexusFlow workflow editor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NexusFlow — Visual Workflow Automation",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  alternates: {
    languages: { en: "/en/login", id: "/id/login" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
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
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-app font-sans text-fg antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
