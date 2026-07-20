import { NextResponse } from "next/server";
import { getLocalizedAdminPath, readAdminLoginArea } from "../../../../../auth/admin-routing";
import {
  type AdminRegistrationFlow,
  getAdminAuthErrorPath,
} from "../../../../../auth/registration-routing";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { isAppLocale } from "../../../../../i18n/locale";

function readFlow(value: string | null): AdminRegistrationFlow {
  return value === "signup" ? "signup" : "login";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeValue = url.searchParams.get("locale");
  const locale = isAppLocale(localeValue) ? localeValue : "en";
  const flow = readFlow(url.searchParams.get("flow"));
  const area = readAdminLoginArea(url.searchParams.get("area"));
  const code = url.searchParams.get("code");
  const client = await createAdminServerClient();

  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(getLocalizedAdminPath(locale), request.url));
    }
  }

  return NextResponse.redirect(
    new URL(getAdminAuthErrorPath(locale, flow, "oauth_unavailable", area), request.url),
  );
}
