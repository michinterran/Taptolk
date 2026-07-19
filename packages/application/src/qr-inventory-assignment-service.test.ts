import { describe, expect, it, vi } from "vitest";
import {
  type ProtectedVehiclePlate,
  QrInventoryAssignmentError,
  type QrInventoryAssignmentRepository,
  QrInventoryAssignmentService,
  type VehiclePlateProtector,
} from "./qr-inventory-assignment-service.js";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const scope = {
  managementCompanyId: id("2"),
  siteId: id("3"),
  tenantId: id("1"),
} as const;
const actor = {
  authorization: {
    mfaVerified: true,
    role: "SITE_ADMIN" as const,
    scope: { ...scope, type: "SITE" as const },
  },
  userId: id("4"),
};

function protectedPlate(value: string): ProtectedVehiclePlate {
  return {
    ciphertext: "v1.nonce.tag.ciphertext",
    keyVersion: 1,
    last4: value.slice(-4),
    lookupHash: "a".repeat(64),
  };
}

function setup() {
  const result = { affectedCount: 1, resourceId: id("9"), version: 2 };
  const repository: QrInventoryAssignmentRepository = {
    assign: vi.fn(async () => result),
    commitImport: vi.fn(async () => result),
    list: vi.fn(async () => ({ assets: [], batches: [], imports: [] })),
    receiveBatch: vi.fn(async () => result),
    replace: vi.fn(async () => result),
    revoke: vi.fn(async () => result),
    saveValidatedImport: vi.fn(async () => result),
  };
  const protector: VehiclePlateProtector = {
    protect: vi.fn(async (plate) => protectedPlate(plate)),
  };
  return {
    protector,
    repository,
    service: new QrInventoryAssignmentService(repository, protector),
  };
}

describe("QR inventory assignment service", () => {
  it("returns the scoped redacted inventory read model", async () => {
    const { repository, service } = setup();
    await expect(service.list({ actor })).resolves.toEqual({
      assets: [],
      batches: [],
      imports: [],
    });
    expect(repository.list).toHaveBeenCalledOnce();
  });

  it("validates CSV without retaining its original bytes or plaintext plate", async () => {
    const { service } = setup();
    const validation = await service.validateVehicleCsv({
      csvBytes: new TextEncoder().encode(
        "vehicle_plate,qr_human_code\n12가3456,0123456789\n34나5678,ABCDEFGHJK\n",
      ),
    });
    expect(validation.sourceChecksumSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(validation.validRows).toHaveLength(2);
    expect(validation.invalidRows).toEqual([]);
    expect(JSON.stringify(validation)).not.toContain("12가3456");
    expect(validation.validRows[0]?.plate.last4).toBe("3456");
  });

  it("reports duplicate and malformed rows before commit", async () => {
    const { service } = setup();
    const validation = await service.validateVehicleCsv({
      csvBytes: new TextEncoder().encode(
        [
          "vehicle_plate,qr_human_code",
          "12가3456,0123456789",
          "12가3456,ABCDEFGHJK",
          "34나5678,0123456789",
          "bad,INVALID",
        ].join("\n"),
      ),
    });
    expect(validation.validRows).toHaveLength(1);
    expect(validation.invalidRows).toEqual([
      { code: "DUPLICATE_PLATE", rowNumber: 3 },
      { code: "DUPLICATE_QR", rowNumber: 4 },
      { code: "INVALID_PLATE", rowNumber: 5 },
    ]);
  });

  it("authorizes and protects a manual assignment before repository access", async () => {
    const { protector, repository, service } = setup();
    await service.assign({
      actor,
      auditRequestId: id("10"),
      expectedAssetVersion: 1,
      normalizedPlate: "12가-3456",
      qrAssetId: id("11"),
      reason: "manual assignment",
      ...scope,
    });
    expect(protector.protect).toHaveBeenCalledWith("12가3456");
    expect(repository.assign).toHaveBeenCalledWith(
      expect.objectContaining({
        plate: expect.objectContaining({ last4: "3456" }),
        qrAssetId: id("11"),
      }),
    );
  });

  it("rejects a CSV with no valid rows", async () => {
    const { service } = setup();
    await expect(
      service.saveValidatedImport({
        actor,
        auditRequestId: id("12"),
        idempotencyKey: id("13"),
        reason: "invalid import",
        validation: {
          invalidRows: [{ code: "INVALID_PLATE", rowNumber: 2 }],
          sourceChecksumSha256: "a".repeat(64),
          validRows: [],
        },
        ...scope,
      }),
    ).rejects.toThrowError(new QrInventoryAssignmentError("NO_VALID_ROWS"));
  });
});
