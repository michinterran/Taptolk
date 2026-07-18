import { describe, expect, it } from "vitest";
import {
  authorizeAdminAction,
  isResourceWithinScope,
  roleHasPermission,
  roleRequiresMfa,
} from "./admin-rbac.js";

const siteA = {
  managementCompanyId: "company-a",
  siteId: "site-a",
  tenantId: "tenant-a",
} as const;

describe("admin RBAC", () => {
  it("requires MFA for privileged administrative roles", () => {
    expect(roleRequiresMfa("SUPER_ADMIN")).toBe(true);
    expect(roleRequiresMfa("SITE_ADMIN")).toBe(true);
    expect(roleRequiresMfa("SITE_OPERATOR")).toBe(false);
  });

  it("keeps read-only memberships free of mutation permissions", () => {
    expect(roleHasPermission("READ_ONLY", "site:read")).toBe(true);
    expect(roleHasPermission("READ_ONLY", "site:update")).toBe(false);
  });

  it("rejects a Site admin outside the exact Site scope", () => {
    const decision = authorizeAdminAction(
      {
        mfaVerified: true,
        role: "SITE_ADMIN",
        scope: {
          managementCompanyId: "company-a",
          siteId: "site-b",
          tenantId: "tenant-a",
          type: "SITE",
        },
      },
      "site:update",
      siteA,
    );

    expect(decision).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" });
  });

  it("allows a verified Management Admin inside the company scope", () => {
    expect(
      authorizeAdminAction(
        {
          mfaVerified: true,
          role: "MANAGEMENT_ADMIN",
          scope: {
            managementCompanyId: "company-a",
            tenantId: "tenant-a",
            type: "MANAGEMENT_COMPANY",
          },
        },
        "site:create",
        siteA,
      ),
    ).toEqual({ allowed: true });
  });

  it("never crosses tenants from a tenant membership", () => {
    expect(isResourceWithinScope({ tenantId: "tenant-b", type: "TENANT" }, siteA)).toBe(false);
  });
});
