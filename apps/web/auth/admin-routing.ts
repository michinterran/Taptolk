import "server-only";

import { type AdminAccessDecision, getAdminLandingArea } from "@taptolk/auth";
import type { Route } from "next";
import type { AppLocale } from "../i18n/config";

export function getLocalizedAdminPath(locale: AppLocale, suffix = ""): Route {
  return `/${locale}/admin${suffix}` as Route;
}

export function getAdminLoginPath(locale: AppLocale, suffix = ""): Route {
  return getLocalizedAdminPath(locale, `/login${suffix}`);
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
      return getAdminLoginPath(locale);
    case "ACCESS_DENIED":
      return getLocalizedAdminPath(locale, "/access");
    case "READY":
      return getReadyAdminPath(locale, decision);
  }
  const exhaustive: never = decision;
  return exhaustive;
}
