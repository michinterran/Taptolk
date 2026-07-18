import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  getRolePermissions,
  roleHasPermission,
  roleRequiresMfa,
} from "./admin-permission-catalog.js";
import { authorizeAdminAction, isResourceWithinScope } from "./admin-rbac.js";

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
    expect(roleHasPermission("READ_ONLY", "site:update-operational")).toBe(false);
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
      "site:update-operational",
      siteA,
    );

    expect(decision).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" });
  });

  it("allows a verified Management Admin to request Site creation inside the company scope", () => {
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
        "site:create-request",
        siteA,
      ),
    ).toEqual({ allowed: true });
  });

  it("reserves direct Site creation and approval for Super Admin", () => {
    expect(roleHasPermission("SUPER_ADMIN", "site:create")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "site:create-approve")).toBe(true);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "site:create")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "site:create-approve")).toBe(false);
  });

  it("centralizes production QR generation approval while delegating scoped requests", () => {
    expect(roleHasPermission("MANAGEMENT_ADMIN", "qr-batch:request")).toBe(true);
    expect(roleHasPermission("SITE_ADMIN", "qr-batch:request")).toBe(true);
    expect(roleHasPermission("SITE_ADMIN", "qr-batch:sample-approve")).toBe(true);
    expect(roleHasPermission("SITE_ADMIN", "qr-batch:generation-approve")).toBe(false);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "qr-batch:generation-approve")).toBe(false);
    expect(roleHasPermission("SUPER_ADMIN", "qr-batch:generation-approve")).toBe(true);
  });

  it("lets Site Operators assign QR assets without issuing or revoking them", () => {
    expect(roleHasPermission("SITE_OPERATOR", "qr-asset:assign")).toBe(true);
    expect(roleHasPermission("SITE_OPERATOR", "qr-batch:request")).toBe(false);
    expect(roleHasPermission("SITE_OPERATOR", "qr-asset:revoke-request")).toBe(false);
  });

  it("returns permissions from the same catalog used by authorization", () => {
    const permissions = getRolePermissions("SUPER_ADMIN");

    expect(permissions).toEqual(ADMIN_PERMISSIONS);
    expect(getRolePermissions("READ_ONLY")).not.toContain("qr-asset:assign");
  });

  it("never crosses tenants from a tenant membership", () => {
    expect(isResourceWithinScope({ tenantId: "tenant-b", type: "TENANT" }, siteA)).toBe(false);
  });
});
