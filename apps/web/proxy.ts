import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { detectLocale, getLocaleFromPathname, LOCALE_COOKIE_NAME } from "./i18n/locale";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (getLocaleFromPathname(pathname)) {
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = detectLocale({
    acceptLanguage: request.headers.get("accept-language"),
    ...(cookieLocale ? { cookieLocale } : {}),
  });
  const destination = request.nextUrl.clone();
  destination.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|brand|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
