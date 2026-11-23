import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const SESSION_COOKIE = "dag_session_token";
const LOCALE_PATH = /^\/(en|id)(?=\/|$)(.*)$/;
/** Pages reachable without a session (everything else under /{locale} requires sign-in). */
const PUBLIC_PAGES = [/^\/login\/?$/, /^\/invite\/[^/]+\/?$/];

/**
 * 1. Fast, edge-safe gate: unauthenticated visitors of app pages are sent to
 *    the login page (with ?next= so they come back afterwards). The session
 *    signature and the user's role are verified again on the server by the
 *    layouts, server actions and API routes — this is only the first line.
 * 2. Locale negotiation (next-intl).
 */
export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const match = pathname.match(LOCALE_PATH);

  if (match) {
    const [, locale, rest] = match;
    const page = rest || "/";
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const hasSession = Boolean(token) && token !== "LOGGED_OUT";

    if (!hasSession && !PUBLIC_PAGES.some((re) => re.test(page))) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = "";
      if (page !== "/") url.searchParams.set("next", `${page}${search}`);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all request paths except:
  // - /api/* (API routes authenticate themselves)
  // - /_next/* (Next.js internals)
  // - /_vercel/* (Vercel internals)
  // - all files with an extension (e.g. favicon.ico, robots.txt, sitemap.xml)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/", "/(en|id)/:path*"],
};
