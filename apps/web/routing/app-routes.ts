import { type AppLocale, SUPPORTED_LOCALES } from "../i18n/config";

/**
 * Single source of truth for the public/administrator surface boundary.
 *
 * The public surface (landing, onboarding, QR, caller, owner) must never require or
 * refresh an administrator session. The administrator surface keeps the existing
 * canonical single sign-in and server-side role routing.
 *
 * Route groups in the App Router do not appear in URLs, so every path produced here
 * is byte-identical to the pre-split contract. Printed QR stickers and issued
 * activation/response links stay valid.
 */

/** Path segment that opens the administrator surface, after the locale segment. */
export const ADMIN_SEGMENT = "admin";

export type SurfaceKind = "admin" | "public";

/** Strips a leading `/ko` or `/en` and returns the remainder, always starting with `/`. */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}`) {
      return "/";
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
  }
  return pathname;
}

/**
 * Classifies a request path. Locale-prefixed and unprefixed paths resolve identically
 * so `/admin` and `/ko/admin` are both administrator paths.
 */
export function classifyPathname(pathname: string): SurfaceKind {
  const remainder = stripLocalePrefix(pathname);
  return remainder === `/${ADMIN_SEGMENT}` || remainder.startsWith(`/${ADMIN_SEGMENT}/`)
    ? "admin"
    : "public";
}

/**
 * Whether a request may refresh the administrator Supabase session.
 *
 * Public routes are excluded so an anonymous QR scan never depends on the
 * administrator authentication provider.
 */
export function requiresAdminSession(pathname: string): boolean {
  return classifyPathname(pathname) === "admin";
}

/** Whether search engines must be kept away from a path. */
export function isNoIndexPathname(pathname: string): boolean {
  return classifyPathname(pathname) === "admin";
}

function withSuffix(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  return suffix.startsWith("/") ? `${base}${suffix}` : `${base}/${suffix}`;
}

/** Builds a localized public path, e.g. `publicRoute("ko", "/onboarding")`. */
export function publicRoute(locale: AppLocale, suffix = ""): string {
  return withSuffix(`/${locale}`, suffix);
}

/** Builds a localized administrator path, e.g. `adminRoute("ko", "/login")`. */
export function adminRoute(locale: AppLocale, suffix = ""): string {
  return withSuffix(`/${locale}/${ADMIN_SEGMENT}`, suffix);
}

/**
 * Public paths that belong in the sitemap.
 *
 * Token-bearing routes (`/q`, `/c`, `/activate`, `/respond`) are deliberately absent:
 * they are reachable only with an issued credential and must not be discoverable.
 * Administrator paths are absent because the whole surface is `noindex`.
 */
export const SITEMAP_PUBLIC_SUFFIXES = ["", "/onboarding"] as const;
