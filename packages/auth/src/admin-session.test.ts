import { describe, expect, it } from "vitest";
import type { AdminMembership, AdminProfile } from "./admin-session.js";
import {
  getAdminLandingArea,
  resolveAdminAccess,
  selectPrimaryAdminMembership,
} from "./admin-session.js";

const profile: AdminProfile = {
  displayName: "Admin",
  status: "ACTIVE",
  userId: "user-1",
};

function membership(
  role: AdminMembership["role"],
  overrides: Partial<AdminMembership> = {},
): AdminMembership {
  return {
    id: `membership-${role}`,
    managementCompanyId: null,
    role,
    scopeType: "PLATFORM",
    siteId: null,
    status: "ACTIVE",
    tenantId: null,
    userId: "user-1",
    ...overrides,
  };
}

describe("admin access resolution", () => {
  it("never treats an unauthenticated request as an admin", () => {
    expect(
      resolveAdminAccess(
        { authenticated: false, hasVerifiedTotp: false, mfaLevel: null },
        profile,
        [membership("SUPER_ADMIN")],
      ),
    ).toEqual({ state: "UNAUTHENTICATED" });
  });

  it("requires an active profile and one active membership", () => {
    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: true, mfaLevel: "aal2" },
        { ...profile, status: "SUSPENDED" },
        [membership("SUPER_ADMIN")],
      ),
    ).toMatchObject({ reason: "PROFILE_INACTIVE", state: "ACCESS_DENIED" });

    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: true, mfaLevel: "aal2" },
        profile,
        [membership("SUPER_ADMIN", { status: "REVOKED" })],
      ),
    ).toMatchObject({ reason: "MEMBERSHIP_INACTIVE", state: "ACCESS_DENIED" });
  });

  it("routes privileged roles through enrollment and then an AAL2 challenge", () => {
    const superAdmin = membership("SUPER_ADMIN");

    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: false, mfaLevel: "aal1" },
        profile,
        [superAdmin],
      ),
    ).toMatchObject({ state: "MFA_ENROLL_REQUIRED" });

    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: true, mfaLevel: "aal1" },
        profile,
        [superAdmin],
      ),
    ).toMatchObject({ state: "MFA_CHALLENGE_REQUIRED" });

    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: true, mfaLevel: "aal2" },
        profile,
        [superAdmin],
      ),
    ).toMatchObject({ state: "READY" });
  });

  it("allows the MVP optional-MFA operator role at AAL1", () => {
    expect(
      resolveAdminAccess(
        { authenticated: true, hasVerifiedTotp: false, mfaLevel: "aal1" },
        profile,
        [
          membership("SITE_OPERATOR", {
            managementCompanyId: "company-1",
            scopeType: "SITE",
            siteId: "site-1",
            tenantId: "tenant-1",
          }),
        ],
      ),
    ).toMatchObject({ state: "READY" });
  });

  it("selects one stable context without merging membership permissions", () => {
    const selected = selectPrimaryAdminMembership([
      membership("READ_ONLY", {
        id: "membership-read",
        scopeType: "TENANT",
        tenantId: "tenant-1",
      }),
      membership("SUPER_ADMIN", { id: "membership-platform" }),
    ]);

    expect(selected?.id).toBe("membership-platform");
    expect(getAdminLandingArea(selected?.role ?? "READ_ONLY")).toBe("platform");
  });
});
