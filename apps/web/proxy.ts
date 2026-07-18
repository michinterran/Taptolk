import { createTaptolkServerClient } from "@taptolk/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readPublicSupabaseConfiguration } from "./auth/configuration";
import { detectLocale, getLocaleFromPathname, LOCALE_COOKIE_NAME } from "./i18n/locale";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  await client.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
