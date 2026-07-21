import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  getRolePermissions,
  roleHasPermission,
  roleRequiresMfa,
} from "./admin-permission-catalog.js";
import {
  authorizeAdminAction,
  isAdminRoleScopeValid,
  isResourceWithinScope,
} from "./admin-rbac.js";

const siteA = {
  managementCompanyId: "company-a",
  siteId: "site-a",
  tenantId: "tenant-a",
} as const;

describe("admin RBAC", () => {
  it("keeps MFA optional for the current pilot admin policy", () => {
    expect(roleRequiresMfa("SUPER_ADMIN")).toBe(false);
    expect(roleRequiresMfa("MANAGEMENT_ADMIN")).toBe(false);
    expect(roleRequiresMfa("SITE_ADMIN")).toBe(false);
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

  it("allows a Management Admin to request Site creation inside the company scope without MFA", () => {
    expect(
      authorizeAdminAction(
        {
          mfaVerified: false,
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

  it("keeps direct Site lifecycle and contract authority aligned with the approved matrix", () => {
    expect(roleHasPermission("SUPER_ADMIN", "site:update-contract")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "site:archive-approve")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "site:update-operational")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "site:suspend-approve")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "site:update-contract")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "site:archive-approve")).toBe(false);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "site:create-request")).toBe(true);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "site:suspend-request")).toBe(true);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "site:suspend-approve")).toBe(false);
    expect(roleHasPermission("SITE_ADMIN", "site:update-operational")).toBe(true);
    expect(roleHasPermission("SITE_ADMIN", "site:update-contract")).toBe(false);
    expect(roleHasPermission("SITE_OPERATOR", "site:update-operational")).toBe(false);
  });

  it("reserves new-account approval for Super Admin", () => {
    expect(roleHasPermission("SUPER_ADMIN", "membership:approve-account")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "membership:approve-account")).toBe(false);
    expect(roleHasPermission("MANAGEMENT_ADMIN", "membership:approve-account")).toBe(false);
  });

  it("reserves Tenant lifecycle mutations for Super Admin", () => {
    expect(roleHasPermission("SUPER_ADMIN", "tenant:create")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "tenant:update")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "tenant:suspend")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "tenant:close")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "tenant:read")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "tenant:create")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "tenant:update")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "tenant:suspend")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "tenant:close")).toBe(false);
  });

  it("reserves Management Company lifecycle mutations for Super Admin", () => {
    expect(roleHasPermission("SUPER_ADMIN", "management-company:create")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "management-company:update")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "management-company:suspend")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "management-company:close")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "management-company:read")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "management-company:create")).toBe(false);
    expect(roleHasPermission("PLATFORM_OPERATOR", "management-company:update")).toBe(false);
  });

  it("validates role and membership scope as one domain rule", () => {
    expect(isAdminRoleScopeValid("SUPER_ADMIN", { type: "PLATFORM" })).toBe(true);
    expect(
      isAdminRoleScopeValid("MANAGEMENT_ADMIN", {
        managementCompanyId: "company-a",
        tenantId: "tenant-a",
        type: "MANAGEMENT_COMPANY",
      }),
    ).toBe(true);
    expect(
      isAdminRoleScopeValid("SITE_ADMIN", {
        managementCompanyId: "company-a",
        tenantId: "tenant-a",
        type: "SITE",
      }),
    ).toBe(false);
    expect(
      isAdminRoleScopeValid("READ_ONLY", {
        managementCompanyId: "company-a",
        siteId: "site-a",
        tenantId: "tenant-a",
        type: "SITE",
      }),
    ).toBe(true);
  });

  it("centralizes production QR generation approval while delegating scoped requests", () => {
    expect(roleHasPermission("MANAGEMENT_ADMIN", "sticker-design:create")).toBe(true);
    expect(roleHasPermission("SITE_ADMIN", "sticker-design:approve")).toBe(true);
    expect(roleHasPermission("PLATFORM_OPERATOR", "sticker-design:archive")).toBe(true);
    expect(roleHasPermission("SITE_OPERATOR", "sticker-design:create")).toBe(false);
    expect(roleHasPermission("READ_ONLY", "sticker-design:read")).toBe(true);
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
