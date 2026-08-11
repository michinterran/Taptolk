import { describe, expect, it, vi } from "vitest";
import {
  AdminAccountInvitationError,
  type AdminAccountInvitationRepository,
  AdminAccountInvitationService,
} from "./admin-account-invitation-service.js";
import { AdminAuthorizationError } from "./authorization-error.js";

const requestId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const tenantId = "33333333-3333-4333-8333-333333333333";
const managementCompanyId = "44444444-4444-4444-8444-444444444444";
const siteId = "55555555-5555-4555-8555-555555555555";

function createRepository(): AdminAccountInvitationRepository {
  return {
    accept: vi.fn(async () => ({ membershipId })),
    invite: vi.fn(async () => ({ membershipId })),
  };
}

function platformActor() {
  return {
    authorization: {
      mfaVerified: false,
      role: "SUPER_ADMIN" as const,
      scope: { type: "PLATFORM" as const },
    },
    userId: "66666666-6666-4666-8666-666666666666",
  };
}

describe("AdminAccountInvitationService", () => {
  it("normalizes the invite identity and keeps the assigned site scope", async () => {
    const repository = createRepository();
    const service = new AdminAccountInvitationService(repository);

    await service.invite({
      actor: platformActor(),
      displayName: "  Site Admin  ",
      email: "  ADMIN@EXAMPLE.COM ",
      reason: "  Initial site administrator assignment  ",
      requestId,
      redirectTo: "https://example.test/api/admin/auth/callback",
      role: "SITE_ADMIN",
      scope: {
        managementCompanyId,
        siteId,
        tenantId,
        type: "SITE",
      },
    });

    expect(repository.invite).toHaveBeenCalledWith({
      displayName: "Site Admin",
      email: "admin@example.com",
      reason: "Initial site administrator assignment",
      requestId,
      redirectTo: "https://example.test/api/admin/auth/callback",
      role: "SITE_ADMIN",
      scope: { managementCompanyId, siteId, tenantId, type: "SITE" },
    });
  });

  it("does not allow a scoped administrator to invite another account", async () => {
    const repository = createRepository();
    const service = new AdminAccountInvitationService(repository);

    await expect(
      service.invite({
        actor: {
          authorization: {
            mfaVerified: false,
            role: "MANAGEMENT_ADMIN",
            scope: { managementCompanyId, tenantId, type: "MANAGEMENT_COMPANY" },
          },
          userId: platformActor().userId,
        },
        displayName: "Site Admin",
        email: "admin@example.com",
        reason: "Site assignment",
        requestId,
        redirectTo: null,
        role: "SITE_ADMIN",
        scope: { managementCompanyId, siteId, tenantId, type: "SITE" },
      }),
    ).rejects.toEqual(new AdminAuthorizationError("OUT_OF_SCOPE"));

    expect(repository.invite).not.toHaveBeenCalled();
  });

  it("rejects invalid identity, reason, and scope before repository access", async () => {
    const repository = createRepository();
    const service = new AdminAccountInvitationService(repository);

    await expect(
      service.invite({
        actor: platformActor(),
        displayName: "Admin",
        email: "not-an-email",
        reason: "ok",
        requestId,
        redirectTo: null,
        role: "SITE_ADMIN",
        scope: { type: "PLATFORM" },
      }),
    ).rejects.toEqual(new AdminAccountInvitationError("INVALID_SCOPE"));

    await expect(service.accept({ membershipId: "not-a-uuid" })).rejects.toEqual(
      new AdminAccountInvitationError("INVALID_MEMBERSHIP_ID"),
    );
    expect(repository.invite).not.toHaveBeenCalled();
    expect(repository.accept).not.toHaveBeenCalled();
  });
});
