import { parseServerEnvironment } from "@taptolk/config";
import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "../i18n/config";
import { publicRoute, SITEMAP_PUBLIC_SUFFIXES } from "../routing/app-routes";

/**
 * Only the public introduction pages are listed.
 *
 * Token-bearing routes (`/q`, `/c`, `/activate`, `/respond`) are excluded because they
 * are reachable solely with an issued credential, and the entire administrator surface is
 * excluded because it is `noindex`.
 *
 * The base URL comes from server configuration; no domain is hardcoded here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const environment = parseServerEnvironment();
  const base = (environment.APP_URL ?? "http://localhost:3000").replace(/\/$/u, "");
  const lastModified = new Date();

  return SUPPORTED_LOCALES.flatMap((locale) =>
    SITEMAP_PUBLIC_SUFFIXES.map((suffix) => ({
      changeFrequency: "monthly" as const,
      lastModified,
      priority: suffix === "" ? 1 : 0.7,
      url: `${base}${publicRoute(locale, suffix)}`,
    })),
  );
}
