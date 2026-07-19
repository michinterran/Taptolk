import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import {
  ManagementCompanyManagementError,
  type ManagementCompanyManagementRepository,
  ManagementCompanyManagementService,
} from "./management-company-management-service.js";

const ACTOR = {
  authorization: {
    mfaVerified: true,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: "8368cb76-4429-4aee-8337-7b65b1a5a688",
};
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_ID = "20000000-0000-4000-8000-000000000001";
const REQUEST_ID = "80000000-0000-4000-8000-000000000001";

function createRepository(): ManagementCompanyManagementRepository {
  return {
    changeStatus: vi.fn(async () => ({ id: COMPANY_ID, version: 2 })),
    create: vi.fn(async () => ({ id: COMPANY_ID, version: 1 })),
    update: vi.fn(async () => ({ id: COMPANY_ID, version: 2 })),
  };
}

describe("Management Company management service", () => {
  it("normalizes name and business number", async () => {
    const repository = createRepository();
    await new ManagementCompanyManagementService(repository).create({
      actor: ACTOR,
      businessNumber: "123-45-67890",
      name: "  Alpha Management  ",
      reason: "  신규 계약  ",
      requestId: REQUEST_ID,
      tenantId: TENANT_ID,
    });
    expect(repository.create).toHaveBeenCalledWith({
      businessNumber: "1234567890",
      name: "Alpha Management",
      reason: "신규 계약",
      requestId: REQUEST_ID,
      tenantId: TENANT_ID,
    });
  });

  it("rejects an invalid business number", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create({
        actor: ACTOR,
        businessNumber: "1234",
        name: "Alpha",
        reason: "신규 계약",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("does not silently discard non-numeric business number input", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create({
        actor: ACTOR,
        businessNumber: "not-a-number",
        name: "Alpha",
        reason: "신규 계약",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects Platform Operator mutation", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).update({
        actor: {
          ...ACTOR,
          authorization: { ...ACTOR.authorization, role: "PLATFORM_OPERATOR" },
        },
        businessNumber: "",
        companyId: COMPANY_ID,
        expectedVersion: 1,
        name: "Alpha",
        reason: "정보 변경",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("keeps CLOSED terminal", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).changeStatus({
        actor: ACTOR,
        companyId: COMPANY_ID,
        currentStatus: "CLOSED",
        expectedVersion: 2,
        nextStatus: "ACTIVE",
        reason: "운영 재개",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_STATUS_TRANSITION"));
    expect(repository.changeStatus).not.toHaveBeenCalled();
  });
});
