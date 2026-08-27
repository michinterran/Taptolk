import { describe, expect, it, vi } from "vitest";
import { QrSvgBundleService } from "./qr-svg-bundle-service.js";

const actor = {
  authorization: {
    mfaVerified: true,
    role: "SITE_ADMIN" as const,
    scope: {
      managementCompanyId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      tenantId: "33333333-3333-4333-8333-333333333333",
      type: "SITE" as const,
    },
  },
  userId: "44444444-4444-4444-8444-444444444444",
};

describe("QrSvgBundleService", () => {
  it("accepts a standard UUID and returns the private SVG bundle", async () => {
    const get = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      checksumSha256: "a".repeat(64),
      filename: "BATCH_001-svg-bundle.zip",
      mimeType: "application/zip",
    });
    const service = new QrSvgBundleService({ get });

    const result = await service.get({
      actor,
      batchId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(get).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
  });

  it("rejects an invalid batch id before repository access", async () => {
    const get = vi.fn();
    const service = new QrSvgBundleService({ get });

    await expect(service.get({ actor, batchId: "invalid" })).rejects.toMatchObject({
      code: "INVALID_ID",
    });
    expect(get).not.toHaveBeenCalled();
  });
});
