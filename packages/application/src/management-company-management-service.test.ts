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

function createInput(
  overrides: Partial<Parameters<ManagementCompanyManagementService["create"]>[0]> = {},
): Parameters<ManagementCompanyManagementService["create"]>[0] {
  return {
    address: " 서울시 중구 ",
    actor: ACTOR,
    businessNumber: "123-45-67890",
    contactEmail: " contact@example.com ",
    contactName: " 담당자 ",
    contactPhoneEncrypted: "v1.encrypted.contact.phone",
    name: "  Alpha Management  ",
    operationsManagerEmail: " manager@example.com ",
    operationsManagerName: " 책임자 ",
    operationsManagerPhoneEncrypted: "v1.encrypted.manager.phone",
    reason: "  신규 계약  ",
    representativePhoneEncrypted: "v1.encrypted.representative.phone",
    requestId: REQUEST_ID,
    ...overrides,
  };
}

describe("Management Company management service", () => {
  it("normalizes registration identity and operating contacts", async () => {
    const repository = createRepository();
    await new ManagementCompanyManagementService(repository).create(createInput());
    expect(repository.create).toHaveBeenCalledWith({
      address: "서울시 중구",
      businessNumber: "1234567890",
      contactEmail: "contact@example.com",
      contactName: "담당자",
      contactPhoneEncrypted: "v1.encrypted.contact.phone",
      name: "Alpha Management",
      operationsManagerEmail: "manager@example.com",
      operationsManagerName: "책임자",
      operationsManagerPhoneEncrypted: "v1.encrypted.manager.phone",
      reason: "신규 계약",
      representativePhoneEncrypted: "v1.encrypted.representative.phone",
      requestId: REQUEST_ID,
    });
  });

  it("rejects an invalid business number", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create(
        createInput({
          businessNumber: "1234",
        }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ["address", { address: "" }, "INVALID_ADDRESS"],
    ["business number", { businessNumber: "" }, "INVALID_BUSINESS_NUMBER"],
    ["primary contact name", { contactName: "" }, "INVALID_CONTACT_NAME"],
  ] as const)("requires the registration %s", async (_label, overrides, code) => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create(createInput(overrides)),
    ).rejects.toEqual(new ManagementCompanyManagementError(code));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("requires at least one primary contact channel", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create(
        createInput({ contactEmail: "", contactPhoneEncrypted: "" }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_CONTACT_CHANNEL"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("requires a complete operations manager group when the optional group is started", async () => {
    const repository = createRepository();
    const service = new ManagementCompanyManagementService(repository);

    await expect(
      service.create(
        createInput({
          operationsManagerEmail: "manager@example.com",
          operationsManagerName: "",
          operationsManagerPhoneEncrypted: "",
        }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_OPERATIONS_MANAGER_NAME"));

    await expect(
      service.create(
        createInput({
          operationsManagerEmail: "",
          operationsManagerName: "책임자",
          operationsManagerPhoneEncrypted: "",
        }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_OPERATIONS_MANAGER_CHANNEL"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("accepts registration without the optional operations manager group", async () => {
    const repository = createRepository();
    await new ManagementCompanyManagementService(repository).create(
      createInput({
        operationsManagerEmail: "",
        operationsManagerName: "",
        operationsManagerPhoneEncrypted: "",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        operationsManagerEmail: null,
        operationsManagerName: null,
        operationsManagerPhoneEncrypted: null,
      }),
    );
  });

  it("does not silently discard non-numeric business number input", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).create(
        createInput({
          businessNumber: "not-a-number",
        }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER"));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects Platform Operator mutation", async () => {
    const repository = createRepository();
    await expect(
      new ManagementCompanyManagementService(repository).update({
        address: "",
        actor: {
          ...ACTOR,
          authorization: { ...ACTOR.authorization, role: "PLATFORM_OPERATOR" },
        },
        businessNumber: "",
        companyId: COMPANY_ID,
        contactEmail: "",
        contactName: "",
        contactPhoneEncrypted: "",
        expectedVersion: 1,
        name: "Alpha",
        operationsManagerEmail: "",
        operationsManagerName: "",
        operationsManagerPhoneEncrypted: "",
        representativePhoneEncrypted: "",
        reason: "정보 변경",
        requestId: REQUEST_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("normalizes workspace updates without accepting a manual management code", async () => {
    const repository = createRepository();
    await new ManagementCompanyManagementService(repository).update({
      address: " 서울시 강남구 ",
      actor: ACTOR,
      businessNumber: "123-45-67890",
      companyId: COMPANY_ID,
      contactEmail: " ops@example.com ",
      contactName: " 현장 담당 ",
      contactPhoneEncrypted: "v1.encrypted.contact.phone",
      expectedVersion: 1,
      name: "  Alpha Updated  ",
      operationsManagerEmail: " lead@example.com ",
      operationsManagerName: " 총괄 ",
      operationsManagerPhoneEncrypted: "",
      reason: " 정보 정비 ",
      representativePhoneEncrypted: "v1.encrypted.representative.phone",
      requestId: REQUEST_ID,
      tenantId: TENANT_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      address: "서울시 강남구",
      businessNumber: "1234567890",
      companyId: COMPANY_ID,
      contactEmail: "ops@example.com",
      contactName: "현장 담당",
      contactPhoneEncrypted: "v1.encrypted.contact.phone",
      expectedVersion: 1,
      name: "Alpha Updated",
      operationsManagerEmail: "lead@example.com",
      operationsManagerName: "총괄",
      operationsManagerPhoneEncrypted: null,
      reason: "정보 정비",
      representativePhoneEncrypted: "v1.encrypted.representative.phone",
      requestId: REQUEST_ID,
    });
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

  it("rejects invalid operational identity fields", async () => {
    const repository = createRepository();
    const service = new ManagementCompanyManagementService(repository);

    await expect(
      service.create(
        createInput({
          address: "x",
        }),
      ),
    ).rejects.toEqual(new ManagementCompanyManagementError("INVALID_ADDRESS"));

    expect(repository.create).not.toHaveBeenCalled();
  });
});
