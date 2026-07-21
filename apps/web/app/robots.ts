import { parseServerEnvironment } from "@taptolk/config";
import type { MetadataRoute } from "next";

/**
 * Keeps crawlers away from the administrator surface and from every token-bearing
 * public route.
 *
 * This is a discoverability control only. Authorization is enforced by the central RBAC
 * policy and independently by PostgreSQL RLS; token routes additionally verify a hashed,
 * purpose-bound, expiring credential.
 */
export default function robots(): MetadataRoute.Robots {
  const environment = parseServerEnvironment();
  const base = (environment.APP_URL ?? "http://localhost:3000").replace(/\/$/u, "");

  return {
    rules: {
      allow: "/",
      disallow: [
        "/ko/admin",
        "/en/admin",
        "/ko/q/",
        "/en/q/",
        "/ko/c/",
        "/en/c/",
        "/ko/activate/",
        "/en/activate/",
        "/ko/respond/",
        "/en/respond/",
        "/api/",
      ],
      userAgent: "*",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
