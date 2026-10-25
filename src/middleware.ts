import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all request paths except:
  // - /api/* (API routes)
  // - /_next/* (Next.js internals)
  // - /_vercel/* (Vercel internals)
  // - all files with an extension (e.g. favicon.ico, images)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/", "/(en|id)/:path*"],
};
