import "server-only";

import type { Route } from "next";
import type { AppLocale } from "../i18n/config";
import { getAdminLoginPath, getLocalizedAdminPath } from "./admin-routing";
import { readAppUrl } from "./configuration";

export type AdminRegistrationFlow = "login" | "signup";

export function getAdminRegistrationPath(locale: AppLocale, suffix = ""): Route {
  return getLocalizedAdminPath(locale, `/signup${suffix}`);
}

export function getAdminAuthErrorPath(
  locale: AppLocale,
  flow: AdminRegistrationFlow,
  error: string,
): Route {
  const base = flow === "signup" ? getAdminRegistrationPath(locale) : getAdminLoginPath(locale);
  return `${base}?error=${encodeURIComponent(error)}` as Route;
}

export function getAdminAuthCallbackUrl(
  locale: AppLocale,
  flow: AdminRegistrationFlow,
): string | null {
  const appUrl = readAppUrl();
  if (!appUrl) {
    return null;
  }

  const callback = new URL("/api/admin/auth/callback", appUrl);
  callback.searchParams.set("flow", flow);
  callback.searchParams.set("locale", locale);
  return callback.toString();
}
