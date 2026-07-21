import { describe, expect, it } from "vitest";
import {
  adminRoute,
  classifyPathname,
  isNoIndexPathname,
  publicRoute,
  requiresAdminSession,
  SITEMAP_PUBLIC_SUFFIXES,
  stripLocalePrefix,
} from "./app-routes";

describe("stripLocalePrefix", () => {
  it("reduces a bare locale path to root", () => {
    expect(stripLocalePrefix("/ko")).toBe("/");
    expect(stripLocalePrefix("/en")).toBe("/");
  });

  it("removes the locale segment and keeps the remainder", () => {
    expect(stripLocalePrefix("/ko/admin/login")).toBe("/admin/login");
    expect(stripLocalePrefix("/en/q/token-value")).toBe("/q/token-value");
  });

  it("leaves unprefixed paths untouched", () => {
    expect(stripLocalePrefix("/admin")).toBe("/admin");
    expect(stripLocalePrefix("/")).toBe("/");
  });

  it("does not treat a locale-like prefix inside a longer segment as a locale", () => {
    expect(stripLocalePrefix("/kor/admin")).toBe("/kor/admin");
    expect(stripLocalePrefix("/english")).toBe("/english");
  });
});

describe("classifyPathname", () => {
  const publicPaths = [
    "/",
    "/ko",
    "/en",
    "/ko/onboarding",
    "/ko/q/public-token",
    "/en/c/session-token",
    "/ko/activate/public-token",
    "/en/respond/response-token",
    "/ko/owner",
    "/ko/owner/offline",
  ];

  const adminPaths = [
    "/admin",
    "/ko/admin",
    "/en/admin",
    "/ko/admin/login",
    "/ko/admin/signup",
    "/ko/admin/dashboard",
    "/ko/admin/platform",
    "/ko/admin/platform/tenants",
    "/ko/admin/platform/revenue",
    "/ko/admin/reports",
    "/ko/admin/mfa/challenge",
    "/en/admin/qr-inventory",
  ];

  it.each(publicPaths)("classifies %s as public", (pathname) => {
    expect(classifyPathname(pathname)).toBe("public");
  });

  it.each(adminPaths)("classifies %s as admin", (pathname) => {
    expect(classifyPathname(pathname)).toBe("admin");
  });

  it("does not classify a path that merely starts with the admin word", () => {
    expect(classifyPathname("/ko/administration")).toBe("public");
    expect(classifyPathname("/ko/admins")).toBe("public");
  });
});

describe("requiresAdminSession", () => {
  it("never refreshes the administrator session on public journeys", () => {
    for (const pathname of ["/ko", "/en", "/ko/q/token", "/ko/c/token", "/ko/owner"]) {
      expect(requiresAdminSession(pathname)).toBe(false);
    }
  });

  it("refreshes the administrator session on the administrator surface", () => {
    for (const pathname of ["/ko/admin", "/ko/admin/login", "/en/admin/dashboard"]) {
      expect(requiresAdminSession(pathname)).toBe(true);
    }
  });
});

describe("isNoIndexPathname", () => {
  it("keeps the whole administrator surface out of search indexes", () => {
    expect(isNoIndexPathname("/ko/admin")).toBe(true);
    expect(isNoIndexPathname("/en/admin/signup")).toBe(true);
  });

  it("leaves the public introduction indexable", () => {
    expect(isNoIndexPathname("/ko")).toBe(false);
    expect(isNoIndexPathname("/en/onboarding")).toBe(false);
  });
});

describe("route builders", () => {
  it("builds localized public paths", () => {
    expect(publicRoute("ko")).toBe("/ko");
    expect(publicRoute("en", "/onboarding")).toBe("/en/onboarding");
    expect(publicRoute("ko", "onboarding")).toBe("/ko/onboarding");
  });

  it("builds localized administrator paths that match the existing contract", () => {
    expect(adminRoute("ko")).toBe("/ko/admin");
    expect(adminRoute("ko", "/login")).toBe("/ko/admin/login");
    expect(adminRoute("en", "/platform")).toBe("/en/admin/platform");
  });

  it("keeps every built administrator path classified as admin", () => {
    for (const suffix of ["", "/login", "/signup", "/dashboard", "/platform"]) {
      expect(classifyPathname(adminRoute("ko", suffix))).toBe("admin");
    }
  });
});

describe("sitemap surface", () => {
  it("lists only public introduction pages", () => {
    expect([...SITEMAP_PUBLIC_SUFFIXES]).toEqual(["", "/onboarding"]);
  });

  it("excludes every token-bearing and administrator route", () => {
    for (const suffix of SITEMAP_PUBLIC_SUFFIXES) {
      const path = publicRoute("ko", suffix);
      expect(classifyPathname(path)).toBe("public");
      expect(path).not.toMatch(/\/(?:q|c|activate|respond)\//u);
    }
  });
});
