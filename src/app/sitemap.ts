import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return ["en", "id"].map((locale) => ({
    url: `${APP_URL}/${locale}/login`,
    changeFrequency: "monthly",
    priority: locale === "en" ? 1 : 0.8,
    alternates: { languages: { en: `${APP_URL}/en/login`, id: `${APP_URL}/id/login` } },
  }));
}
