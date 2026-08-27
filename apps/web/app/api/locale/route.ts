import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME } from "../../../i18n/config";
import { getLocaleFromPathname, isAppLocale } from "../../../i18n/locale";

function getSafeReturnPath(value: string | null, locale: "ko" | "en"): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return `/${locale}`;
  }

  return getLocaleFromPathname(value) === locale ? value : `/${locale}`;
}

export function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  if (!isAppLocale(locale)) {
    return NextResponse.json(
      { error: { code: "INVALID_LOCALE", retryable: false } },
      { status: 400 },
    );
  }

  const returnPath = getSafeReturnPath(request.nextUrl.searchParams.get("returnTo"), locale);
  const response = NextResponse.redirect(new URL(returnPath, request.url));
  response.cookies.set({
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    name: LOCALE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    value: locale,
  });

  return response;
}
