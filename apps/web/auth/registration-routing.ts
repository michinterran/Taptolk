import "server-only";

import type { Route } from "next";
import type { AppLocale } from "../i18n/config";
import { type AdminLoginArea, getAdminLoginPath, getLocalizedAdminPath } from "./admin-routing";
import { readAppUrl } from "./configuration";

export type AdminRegistrationFlow = "login" | "signup";

export function getAdminRegistrationPath(locale: AppLocale, suffix = ""): Route {
  return getLocalizedAdminPath(locale, `/signup${suffix}`);
}

export function getAdminAuthErrorPath(
  locale: AppLocale,
  flow: AdminRegistrationFlow,
  error: string,
  area: AdminLoginArea = "customer",
): Route {
  const base =
    flow === "signup" ? getAdminRegistrationPath(locale) : getAdminLoginPath(locale, area);
  return `${base}?error=${encodeURIComponent(error)}` as Route;
}

export function getAdminAuthCallbackUrl(
  locale: AppLocale,
  flow: AdminRegistrationFlow,
  area: AdminLoginArea = "customer",
): string | null {
  const appUrl = readAppUrl();
  if (!appUrl) {
    return null;
  }

  const callback = new URL("/api/admin/auth/callback", appUrl);
  callback.searchParams.set("flow", flow);
  callback.searchParams.set("locale", locale);
  callback.searchParams.set("area", area);
  return callback.toString();
}
