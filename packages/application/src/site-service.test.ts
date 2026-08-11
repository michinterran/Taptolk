import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import {
  SiteApplicationService,
  SiteManagementError,
  type SiteManagementRepository,
} from "./site-service.js";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_ID = "20000000-0000-4000-8000-000000000001";
const SITE_ID = "40000000-0000-4000-8000-000000000001";
const REQUEST_ID = "80000000-0000-4000-8000-000000000001";
const SUPER_ACTOR = {
  authorization: {
    mfaVerified: true,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: "8368cb76-4429-4aee-8337-7b65b1a5a688",
};

function createRepository(): SiteManagementRepository {
  return {
    changeStatus: vi.fn(async () => ({ id: SITE_ID, version: 2 })),
    create: vi.fn(async () => ({ id: SITE_ID, version: 1 })),
    updateContract: vi.fn(async () => ({ id: SITE_ID, version: 2 })),
    updateOperational: vi.fn(async () => ({ id: SITE_ID, version: 2 })),
  };
}

describe("Site application service", () => {
  it("normalizes a direct Site creation command", async () => {
    const repository = createRepository();
    await new SiteApplicationService(repository).create({
      actor: SUPER_ACTOR,
      address: " 서울시 중구 ",
      contractVehicleLimit: 100,
      managementCompanyId: COMPANY_ID,
      name: " 한빛 아파트 ",
      reason: " 신규 계약 ",
      requestId: REQUEST_ID,
      tenantId: TENANT_ID,
      timezone: " Asia/Seoul ",
      type: "APARTMENT",
    });
    expect(repository.create).toHaveBeenCalledWith({
      address: "서울시 중구",
      contractVehicleLimit: 100,
      managementCompanyId: COMPANY_ID,
      name: "한빛 아파트",
      reason: "신규 계약",
      requestId: REQUEST_ID,
      tenantId: TENANT_ID,
      timezone: "Asia/Seoul",
      type: "APARTMENT",
    });
  });

  it("blocks direct creation by a Management Admin", async () => {
    const repository = createRepository();
    await expect(
      new SiteApplicationService(repository).create({
        actor: {
          authorization: {
            mfaVerified: true,
            role: "MANAGEMENT_ADMIN",
            scope: {
              managementCompanyId: COMPANY_ID,
              tenantId: TENANT_ID,
              type: "MANAGEMENT_COMPANY",
            },
          },
          userId: SUPER_ACTOR.userId,
        },
        address: "",
        contractVehicleLimit: 10,
        managementCompanyId: COMPANY_ID,
        name: "Requested Site",
        reason: "신규 요청",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
        timezone: "Asia/Seoul",
        type: "APARTMENT",
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("allows a Site Admin to update only the exact Site scope", async () => {
    const repository = createRepository();
    const service = new SiteApplicationService(repository);
    const actor = {
      authorization: {
        mfaVerified: true,
        role: "SITE_ADMIN" as const,
        scope: {
          managementCompanyId: COMPANY_ID,
          siteId: SITE_ID,
          tenantId: TENANT_ID,
          type: "SITE" as const,
        },
      },
      userId: SUPER_ACTOR.userId,
    };
    await service.updateOperational({
      actor,
      address: "서울시 중구",
      expectedVersion: 1,
      managementCompanyId: COMPANY_ID,
      name: "Updated Site",
      reason: "운영 정보 변경",
      requestId: REQUEST_ID,
      siteId: SITE_ID,
      tenantId: TENANT_ID,
      timezone: "Asia/Seoul",
      type: "BUILDING",
    });
    expect(repository.updateOperational).toHaveBeenCalledOnce();

    await expect(
      service.updateOperational({
        actor,
        address: "서울시 중구",
        expectedVersion: 1,
        managementCompanyId: COMPANY_ID,
        name: "Forbidden Site",
        reason: "운영 정보 변경",
        requestId: REQUEST_ID,
        siteId: "40000000-0000-4000-8000-000000000002",
        tenantId: TENANT_ID,
        timezone: "Asia/Seoul",
        type: "BUILDING",
      }),
    ).rejects.toEqual(new AdminAuthorizationError("OUT_OF_SCOPE"));
  });

  it("reserves contract vehicle limit changes for Super Admin", async () => {
    const repository = createRepository();
    await expect(
      new SiteApplicationService(repository).updateContract({
        actor: {
          authorization: {
            mfaVerified: false,
            role: "PLATFORM_OPERATOR",
            scope: { type: "PLATFORM" },
          },
          userId: SUPER_ACTOR.userId,
        },
        contractVehicleLimit: 200,
        expectedVersion: 1,
        managementCompanyId: COMPANY_ID,
        reason: "계약 한도 변경",
        requestId: REQUEST_ID,
        siteId: SITE_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.updateContract).not.toHaveBeenCalled();
  });

  it("rejects invalid timezone and terminal lifecycle transitions", async () => {
    const repository = createRepository();
    const service = new SiteApplicationService(repository);
    await expect(
      service.create({
        actor: SUPER_ACTOR,
        address: "서울시 중구",
        contractVehicleLimit: 10,
        managementCompanyId: COMPANY_ID,
        name: "Invalid Timezone",
        reason: "신규 계약",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
        timezone: "Not/A_Timezone",
        type: "APARTMENT",
      }),
    ).rejects.toEqual(new SiteManagementError("INVALID_TIMEZONE"));

    await expect(
      service.changeStatus({
        actor: SUPER_ACTOR,
        currentStatus: "CLOSED",
        expectedVersion: 2,
        managementCompanyId: COMPANY_ID,
        nextStatus: "ACTIVE",
        reason: "운영 재개",
        requestId: REQUEST_ID,
        siteId: SITE_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new SiteManagementError("INVALID_STATUS_TRANSITION"));
  });

  it.each([
    { address: "", contractVehicleLimit: 10, code: "INVALID_ADDRESS" },
    { address: "서울시 중구", contractVehicleLimit: 0, code: "INVALID_CONTRACT_VEHICLE_LIMIT" },
  ] as const)("rejects an incomplete active Site registration: $code", async (input) => {
    const repository = createRepository();
    await expect(
      new SiteApplicationService(repository).create({
        actor: SUPER_ACTOR,
        address: input.address,
        contractVehicleLimit: input.contractVehicleLimit,
        managementCompanyId: COMPANY_ID,
        name: "Incomplete Site",
        reason: "신규 계약",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
        timezone: "Asia/Seoul",
        type: "APARTMENT",
      }),
    ).rejects.toEqual(new SiteManagementError(input.code));
    expect(repository.create).not.toHaveBeenCalled();
  });
});
