import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import {
  TenantManagementError,
  type TenantManagementRepository,
  TenantManagementService,
} from "./tenant-management-service.js";

const ACTOR = {
  authorization: {
    mfaVerified: true,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: "8368cb76-4429-4aee-8337-7b65b1a5a688",
};
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_ID = "80000000-0000-4000-8000-000000000001";

function createRepository(): TenantManagementRepository {
  return {
    changeStatus: vi.fn(async () => ({ id: TENANT_ID, version: 2 })),
    create: vi.fn(async () => ({ id: TENANT_ID, version: 1 })),
    update: vi.fn(async () => ({ id: TENANT_ID, version: 2 })),
  };
}

describe("Tenant management service", () => {
  it("normalizes a create command before repository access", async () => {
    const repository = createRepository();
    await new TenantManagementService(repository).create({
      actor: ACTOR,
      name: "  Alpha Residence  ",
      reason: "  신규 계약 등록  ",
      requestId: REQUEST_ID,
      slug: "  Alpha-Residence  ",
    });
    expect(repository.create).toHaveBeenCalledWith({
      name: "Alpha Residence",
      reason: "신규 계약 등록",
      requestId: REQUEST_ID,
      slug: "alpha-residence",
    });
  });

  it("rejects invalid slugs before repository access", async () => {
    const repository = createRepository();
    await expect(
      new TenantManagementService(repository).create({
        actor: ACTOR,
        name: "Alpha",
        reason: "신규 등록",
        requestId: REQUEST_ID,
        slug: "한글 식별자",
      }),
    ).rejects.toEqual(new TenantManagementError("INVALID_SLUG"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects platform operators from Tenant mutation", async () => {
    const repository = createRepository();
    await expect(
      new TenantManagementService(repository).update({
        actor: {
          ...ACTOR,
          authorization: {
            ...ACTOR.authorization,
            role: "PLATFORM_OPERATOR",
          },
        },
        expectedVersion: 1,
        name: "Alpha",
        reason: "정보 변경",
        requestId: REQUEST_ID,
        slug: "alpha",
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("enforces the Tenant lifecycle transition matrix", async () => {
    const repository = createRepository();
    await expect(
      new TenantManagementService(repository).changeStatus({
        actor: ACTOR,
        currentStatus: "CLOSED",
        expectedVersion: 2,
        nextStatus: "ACTIVE",
        reason: "운영 재개",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new TenantManagementError("INVALID_STATUS_TRANSITION"));
    expect(repository.changeStatus).not.toHaveBeenCalled();
  });
});
