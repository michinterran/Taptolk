import { createTaptolkServerClient } from "@taptolk/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readPublicSupabaseConfiguration } from "./auth/configuration";
import { detectLocale, getLocaleFromPathname, LOCALE_COOKIE_NAME } from "./i18n/locale";
import { requiresAdminSession } from "./routing/app-routes";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Locale resolution applies to every user-facing route, public and administrator alike.
  if (!getLocaleFromPathname(pathname)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
    const locale = detectLocale({
      acceptLanguage: request.headers.get("accept-language"),
      ...(cookieLocale ? { cookieLocale } : {}),
    });
    const destination = request.nextUrl.clone();
    destination.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

    return NextResponse.redirect(destination);
  }

  const response = NextResponse.next({ request });

  // Administrator session refresh is scoped to the administrator surface only.
  // Landing, onboarding, QR scan, caller waiting room, activation, owner response, and
  // owner home never touch the administrator authentication provider.
  if (!requiresAdminSession(pathname)) {
    return response;
  }

  const configuration = readPublicSupabaseConfiguration();
  if (!configuration) {
    return response;
  }

  const client = createTaptolkServerClient(configuration, {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, options, value } of cookiesToSet) {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }
    },
  });

  try {
    await client.auth.getClaims();
  } catch {
    // A failed refresh attempt must not block admin routing; page guards validate the user.
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
