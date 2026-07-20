import "server-only";

import { type AdminAccessDecision, getAdminLandingArea } from "@taptolk/auth";
import type { Route } from "next";
import type { AppLocale } from "../i18n/config";

export type AdminLoginArea = "customer" | "platform";

export function getLocalizedAdminPath(locale: AppLocale, suffix = ""): Route {
  return `/${locale}/admin${suffix}` as Route;
}

export function readAdminLoginArea(value: FormDataEntryValue | string | null): AdminLoginArea {
  return value === "platform" ? "platform" : "customer";
}

export function getAdminLoginPath(locale: AppLocale, area: AdminLoginArea, suffix = ""): Route {
  const base = area === "platform" ? "/platform/login" : "/login";
  return getLocalizedAdminPath(locale, `${base}${suffix}`);
}

export function getReadyAdminPath(
  locale: AppLocale,
  decision: Extract<AdminAccessDecision, { state: "READY" }>,
): Route {
  return getAdminLandingArea(decision.membership.role) === "platform"
    ? getLocalizedAdminPath(locale, "/platform")
    : getLocalizedAdminPath(locale, "/dashboard");
}

export function getAdminDecisionPath(locale: AppLocale, decision: AdminAccessDecision): Route {
  switch (decision.state) {
    case "UNAUTHENTICATED":
      return getAdminLoginPath(locale, "customer");
    case "ACCESS_DENIED":
      return getLocalizedAdminPath(locale, "/access");
    case "MFA_ENROLL_REQUIRED":
      return getLocalizedAdminPath(locale, "/mfa/enroll");
    case "MFA_CHALLENGE_REQUIRED":
      return getLocalizedAdminPath(locale, "/mfa/challenge");
    case "READY":
      return getReadyAdminPath(locale, decision);
  }
}
