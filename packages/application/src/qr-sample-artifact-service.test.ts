import { describe, expect, it, vi } from "vitest";
import { QrSampleArtifactService } from "./qr-sample-artifact-service.js";

describe("QrSampleArtifactService", () => {
  it("authorizes before returning a private sample artifact", async () => {
    const get = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      checksumSha256: "a".repeat(64),
      mimeType: "image/png",
    });
    const service = new QrSampleArtifactService({ get });
    const result = await service.get({
      actor: {
        authorization: {
          mfaVerified: true,
          role: "SITE_ADMIN",
          scope: {
            managementCompanyId: "11111111-1111-4111-8111-111111111111",
            siteId: "22222222-2222-4222-8222-222222222222",
            tenantId: "33333333-3333-4333-8333-333333333333",
            type: "SITE",
          },
        },
        userId: "44444444-4444-4444-8444-444444444444",
      },
      sampleId: "55555555-5555-4555-8555-555555555555",
    });
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(get).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
  });
});
