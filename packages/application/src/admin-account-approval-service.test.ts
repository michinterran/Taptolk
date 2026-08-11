import { describe, expect, it, vi } from "vitest";
import {
  AdminAccountApprovalError,
  type AdminAccountApprovalRepository,
  AdminAccountApprovalService,
} from "./admin-account-approval-service.js";
import { AdminAuthorizationError } from "./authorization-error.js";

const actorUserId = "8368cb76-4429-4aee-8337-7b65b1a5a688";
const targetUserId = "4f7efd32-3899-41b1-afc8-065db565d285";
const requestId = "96115f29-b35d-4de8-85a5-d27d364b4e75";

function createRepository(): AdminAccountApprovalRepository {
  return {
    approve: vi.fn(async () => ({
      membershipId: "3bc0282d-e077-479f-824f-f7bdc78d7d55",
    })),
    findUserIdByEmail: vi.fn(async () => targetUserId),
    listPendingAccounts: vi.fn(async () => ({
      accounts: [
        {
          createdAt: "2026-07-18T15:03:43.000Z",
          email: "candidate@example.com",
          emailVerified: true,
          provider: "google" as const,
          suggestedDisplayName: "Candidate",
          userId: targetUserId,
        },
      ],
      truncated: false,
    })),
    listScopeCatalog: vi.fn(async () => ({
      managementCompanies: [],
      sites: [],
      tenants: [],
    })),
    reject: vi.fn(async () => undefined),
  };
}

const superAdmin = {
  authorization: {
    mfaVerified: true,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: actorUserId,
};

describe("Admin account approval service", () => {
  it("returns the bounded approval queue only to an authorized Super Admin", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    const result = await service.list({ actor: superAdmin });

    expect(result.queue).toMatchObject({ page: 1, total: 1, truncated: false });
    expect(repository.listPendingAccounts).toHaveBeenCalledWith({ limit: 1_000 });
  });

  it("filters by name or email and preserves the requested registration order", async () => {
    const repository = createRepository();
    vi.mocked(repository.listPendingAccounts).mockResolvedValue({
      accounts: [
        {
          createdAt: "2026-07-20T15:03:43.000Z",
          email: "older@example.com",
          emailVerified: true,
          provider: "email",
          suggestedDisplayName: "Older Candidate",
          userId: "b8e2d3f0-e0f1-4ff1-93ca-dcbff87f4b0d",
        },
        {
          createdAt: "2026-07-22T15:03:43.000Z",
          email: "newer@example.com",
          emailVerified: false,
          provider: "email",
          suggestedDisplayName: "Newer Candidate",
          userId: "c8e2d3f0-e0f1-4ff1-93ca-dcbff87f4b0d",
        },
      ],
      truncated: false,
    });
    const service = new AdminAccountApprovalService(repository);

    const result = await service.list({
      actor: superAdmin,
      search: "  NEWER@EXAMPLE.COM ",
      sort: "oldest",
    });

    expect(result.queue.total).toBe(1);
    expect(result.queue.accounts[0]?.email).toBe("newer@example.com");
  });

  it("sorts the complete bounded queue before applying pagination", async () => {
    const repository = createRepository();
    vi.mocked(repository.listPendingAccounts).mockResolvedValue({
      accounts: [
        {
          createdAt: "2026-07-20T15:03:43.000Z",
          email: "older@example.com",
          emailVerified: true,
          provider: "email",
          suggestedDisplayName: "Older Candidate",
          userId: "b8e2d3f0-e0f1-4ff1-93ca-dcbff87f4b0d",
        },
        {
          createdAt: "2026-07-22T15:03:43.000Z",
          email: "newer@example.com",
          emailVerified: false,
          provider: "email",
          suggestedDisplayName: "Newer Candidate",
          userId: "c8e2d3f0-e0f1-4ff1-93ca-dcbff87f4b0d",
        },
      ],
      truncated: false,
    });
    const service = new AdminAccountApprovalService(repository);

    const result = await service.list({ actor: superAdmin, sort: "oldest" });

    expect(result.queue.accounts.map((account) => account.email)).toEqual([
      "older@example.com",
      "newer@example.com",
    ]);
  });

  it("rejects a Platform Operator before reading the Auth directory", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    await expect(
      service.list({
        actor: {
          authorization: {
            mfaVerified: true,
            role: "PLATFORM_OPERATOR",
            scope: { type: "PLATFORM" },
          },
          userId: actorUserId,
        },
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.listPendingAccounts).not.toHaveBeenCalled();
  });

  it("normalizes an approval and preserves its explicit scope", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    await service.approve({
      actor: superAdmin,
      displayName: "  Platform Operator  ",
      reason: "  Approved for staging operations.  ",
      requestId,
      role: "PLATFORM_OPERATOR",
      scope: { type: "PLATFORM" },
      targetUserId,
    });

    expect(repository.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Platform Operator",
        reason: "Approved for staging operations.",
        role: "PLATFORM_OPERATOR",
        scope: { type: "PLATFORM" },
      }),
    );
  });

  it("rejects an invalid role and scope combination before mutation", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    await expect(
      service.approve({
        actor: superAdmin,
        displayName: "Site Admin",
        reason: "Approved for one site.",
        requestId,
        role: "SITE_ADMIN",
        scope: { type: "PLATFORM" },
        targetUserId,
      }),
    ).rejects.toEqual(new AdminAccountApprovalError("INVALID_SCOPE"));
    expect(repository.approve).not.toHaveBeenCalled();
  });

  it("assigns a validated scope to an existing account by normalized email", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    await service.assignExisting({
      actor: superAdmin,
      displayName: "  Management Admin  ",
      email: "  ADMIN@EXAMPLE.COM ",
      reason: "Approved for the management company operations team.",
      requestId,
      role: "MANAGEMENT_ADMIN",
      scope: {
        managementCompanyId: targetUserId,
        tenantId: actorUserId,
        type: "MANAGEMENT_COMPANY",
      },
    });

    expect(repository.findUserIdByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(repository.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Management Admin",
        role: "MANAGEMENT_ADMIN",
        scope: {
          managementCompanyId: targetUserId,
          tenantId: actorUserId,
          type: "MANAGEMENT_COMPANY",
        },
        targetUserId,
      }),
    );
  });

  it("returns a distinct error when the existing account cannot be found", async () => {
    const repository = createRepository();
    vi.mocked(repository.findUserIdByEmail).mockResolvedValue(null);
    const service = new AdminAccountApprovalService(repository);

    await expect(
      service.assignExisting({
        actor: superAdmin,
        displayName: "Management Admin",
        email: "missing@example.com",
        reason: "Approved for the management company operations team.",
        requestId,
        role: "MANAGEMENT_ADMIN",
        scope: {
          managementCompanyId: targetUserId,
          tenantId: actorUserId,
          type: "MANAGEMENT_COMPANY",
        },
      }),
    ).rejects.toEqual(new AdminAccountApprovalError("ACCOUNT_NOT_FOUND"));
    expect(repository.approve).not.toHaveBeenCalled();
  });

  it("prevents a Super Admin from deciding their own account", async () => {
    const repository = createRepository();
    const service = new AdminAccountApprovalService(repository);

    await expect(
      service.reject({
        actor: superAdmin,
        displayName: "Super Admin",
        reason: "Self action must fail.",
        requestId,
        targetUserId: actorUserId,
      }),
    ).rejects.toEqual(new AdminAccountApprovalError("SELF_ACTION_FORBIDDEN"));
    expect(repository.reject).not.toHaveBeenCalled();
  });
});
