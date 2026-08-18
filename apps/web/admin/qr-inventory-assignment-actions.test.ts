import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const tenantId = id("1");
const managementCompanyId = id("2");
const siteId = id("3");

const mocks = vi.hoisted(() => ({
  advanceBatchDelivery: vi.fn(),
  assign: vi.fn(),
  commitImport: vi.fn(),
  list: vi.fn(),
  protect: vi.fn(),
  receiveBatch: vi.fn(),
  receiveBatchQuantity: vi.fn(),
  redirect: vi.fn(),
  replace: vi.fn(),
  revoke: vi.fn(),
  saveValidatedImport: vi.fn(),
}));

vi.mock("@taptolk/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@taptolk/config")>()),
  parseServerEnvironment: () => ({
    APP_ENCRYPTION_KEY_V1: "a".repeat(32),
    TOKEN_HMAC_KEY: "b".repeat(32),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("../auth/admin-authorization", () => ({
  toAdminAuthorizationContext: () => ({
    mfaVerified: true,
    role: "SUPER_ADMIN",
    scope: {
      managementCompanyId,
      siteId,
      tenantId,
      type: "SITE",
    },
  }),
}));

vi.mock("../auth/page-guard", () => ({
  requireReadyAdminContext: vi.fn(async () => ({
    decision: { membership: { role: "SUPER_ADMIN" } },
    mfaLevel: "aal2",
    userId: id("4"),
  })),
}));

vi.mock("../auth/server-client", () => ({
  createAdminServerClient: vi.fn(async () => ({ rpc: vi.fn() })),
}));

vi.mock("./supabase-qr-inventory-assignment-repository", () => ({
  createSupabaseQrInventoryAssignmentRepository: () => ({
    advanceBatchDelivery: mocks.advanceBatchDelivery,
    assign: mocks.assign,
    commitImport: mocks.commitImport,
    list: mocks.list,
    receiveBatch: mocks.receiveBatch,
    receiveBatchQuantity: mocks.receiveBatchQuantity,
    replace: mocks.replace,
    revoke: mocks.revoke,
    saveValidatedImport: mocks.saveValidatedImport,
  }),
  QrInventoryAssignmentRepositoryError: class QrInventoryAssignmentRepositoryError extends Error {
    constructor(readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE") {
      super(code);
    }
  },
}));

vi.mock("./vehicle-plate-protector", () => ({
  AesGcmVehiclePlateProtector: class AesGcmVehiclePlateProtector {
    protect = mocks.protect;
  },
}));

import {
  advanceQrBatchDelivery,
  assignQrAsset,
  commitVehicleImport,
  validateVehicleImport,
} from "./qr-inventory-assignment-actions";

function baseFormData(): FormData {
  const formData = new FormData();
  formData.set("locale", "ko");
  formData.set("tenantId", tenantId);
  formData.set("managementCompanyId", managementCompanyId);
  formData.set("siteId", siteId);
  formData.set("reason", "운영자 승인 작업");
  formData.set("expectedVersion", "1");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  const result = { affectedCount: 1, resourceId: id("9"), version: 2 };
  for (const command of [
    mocks.advanceBatchDelivery,
    mocks.assign,
    mocks.commitImport,
    mocks.receiveBatch,
    mocks.receiveBatchQuantity,
    mocks.replace,
    mocks.revoke,
    mocks.saveValidatedImport,
  ]) {
    command.mockResolvedValue(result);
  }
  mocks.list.mockResolvedValue({ assets: [], batches: [], imports: [] });
  mocks.protect.mockImplementation(async (plate: string) => ({
    ciphertext: "v1.nonce.tag.ciphertext",
    keyVersion: 1,
    last4: plate.slice(-4),
    lookupHash: "c".repeat(64),
  }));
  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  });
});

describe("QR inventory assignment server actions", () => {
  it("routes a Super Admin delivery transition through the application service", async () => {
    const formData = baseFormData();
    formData.set("batchId", id("12"));
    formData.set("expectedVersion", "7");
    formData.set("targetStatus", "SENT_TO_PRINTER");
    formData.set("view", "production");

    await expect(advanceQrBatchDelivery(formData)).rejects.toThrow(
      `REDIRECT:/ko/admin/qr-inventory/sites/${siteId}?status=batchDeliveryAdvanced&view=production`,
    );

    expect(mocks.advanceBatchDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: id("12"),
        expectedBatchVersion: 7,
        targetStatus: "SENT_TO_PRINTER",
      }),
    );
  });

  it("routes a protected manual assignment through the application service", async () => {
    const formData = baseFormData();
    formData.set("qrAssetId", id("10"));
    formData.set("vehiclePlate", "12가-3456");
    formData.set("view", "assignment");

    await expect(assignQrAsset(formData)).rejects.toThrow(
      `REDIRECT:/ko/admin/qr-inventory/sites/${siteId}?status=assetAssigned&view=assignment`,
    );

    expect(mocks.protect).toHaveBeenCalledWith("12가3456");
    expect(mocks.assign).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedAssetVersion: 1,
        plate: expect.objectContaining({ last4: "3456" }),
        qrAssetId: id("10"),
      }),
    );
    expect(JSON.stringify(mocks.assign.mock.calls)).not.toContain("12가3456");
  });

  it("validates and saves a CSV import without repository plaintext plates", async () => {
    const formData = baseFormData();
    formData.set("siteScope", `${tenantId}|${managementCompanyId}|${siteId}`);
    formData.set("view", "assignment");
    formData.set(
      "csvFile",
      new File(["vehicle_plate,qr_human_code\n12가3456,0123456789\n"], "vehicle-import.csv", {
        type: "text/csv",
      }),
    );

    await expect(validateVehicleImport(formData)).rejects.toThrow(
      `REDIRECT:/ko/admin/qr-inventory/sites/${siteId}?status=importValidated&view=assignment`,
    );

    expect(mocks.saveValidatedImport).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId,
        validRows: [
          expect.objectContaining({
            plate: expect.objectContaining({ last4: "3456" }),
            qrHumanCode: "0123456789",
          }),
        ],
      }),
    );
    expect(JSON.stringify(mocks.saveValidatedImport.mock.calls)).not.toContain("12가3456");
  });

  it("routes a validated import commit with optimistic versioning", async () => {
    const formData = baseFormData();
    formData.set("importId", id("11"));
    formData.set("expectedVersion", "3");
    formData.set("view", "assignment");

    await expect(commitVehicleImport(formData)).rejects.toThrow(
      `REDIRECT:/ko/admin/qr-inventory/sites/${siteId}?status=importCommitted&view=assignment`,
    );

    expect(mocks.commitImport).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedImportVersion: 3,
        importId: id("11"),
      }),
    );
  });
});
