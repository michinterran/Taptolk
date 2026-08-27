import { describe, expect, it, vi } from "vitest";
import { type BrandAssetRepository, BrandAssetService } from "./brand-asset-service.js";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("brand asset service", () => {
  it("sanitizes and inspects the logo before repository upload", async () => {
    const repository: BrandAssetRepository = {
      uploadAndRegister: vi.fn(async (input) => ({
        resourceId: id("8"),
        storagePath: input.storagePath,
        version: 1,
      })),
    };
    const service = new BrandAssetService(repository);
    const bytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#ffffff"/></svg>',
    );

    const result = await service.upload({
      actor: {
        authorization: {
          mfaVerified: true,
          role: "SITE_ADMIN",
          scope: {
            managementCompanyId: id("2"),
            siteId: id("3"),
            tenantId: id("1"),
            type: "SITE",
          },
        },
        userId: id("4"),
      },
      assetType: "SITE_LOGO",
      auditRequestId: id("5"),
      bytes,
      filename: "site-logo.svg",
      managementCompanyId: id("2"),
      mimeType: "image/svg+xml",
      name: "Site logo",
      reason: "approved logo source",
      siteId: id("3"),
      tenantId: id("1"),
    });

    expect(result.resourceId).toBe(id("8"));
    expect(repository.uploadAndRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        heightPx: 128,
        mimeType: "image/svg+xml",
        storagePath: expect.stringMatching(new RegExp(`^${id("1")}/.+\\.svg$`, "u")),
        widthPx: 128,
      }),
    );
  });
});
