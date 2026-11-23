import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Only the public sign-in pages are indexable; the app itself sits behind authentication. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/en/login", "/id/login"],
        disallow: ["/api/", "/en/", "/id/", "/*/invite/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
