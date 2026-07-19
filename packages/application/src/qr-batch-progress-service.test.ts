import { describe, expect, it, vi } from "vitest";
import { QrBatchProgressService } from "./qr-batch-progress-service.js";

const userId = "11111111-1111-4111-8111-111111111111";

describe("QrBatchProgressService", () => {
  it("authorizes a scoped reader before returning the redacted progress model", async () => {
    const list = vi.fn().mockResolvedValue([
      {
        batchCode: "BATCH_001",
        executionAttemptCount: 1,
        exportTypes: ["PDF", "ZIP"],
        failedQuantity: 0,
        generatedQuantity: 1_000,
        id: "22222222-2222-4222-8222-222222222222",
        jobStatus: "COMPLETED",
        passedQuantity: 1_000,
        processedCount: 1_000,
        renderedQuantity: 1_000,
        requestedQuantity: 1_000,
        siteName: "Site A",
        status: "PRINT_FILE_READY",
      },
    ]);
    const service = new QrBatchProgressService({ list });

    const result = await service.list({
      actor: {
        authorization: {
          mfaVerified: true,
          role: "SITE_ADMIN",
          scope: {
            managementCompanyId: "55555555-5555-4555-8555-555555555555",
            siteId: "33333333-3333-4333-8333-333333333333",
            tenantId: "44444444-4444-4444-8444-444444444444",
            type: "SITE",
          },
        },
        userId,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.exportTypes).toEqual(["PDF", "ZIP"]);
    expect(list).toHaveBeenCalledOnce();
  });

  it("rejects an invalid actor before repository access", async () => {
    const list = vi.fn();
    const service = new QrBatchProgressService({ list });

    await expect(
      service.list({
        actor: {
          authorization: {
            mfaVerified: true,
            role: "SITE_ADMIN",
            scope: {
              managementCompanyId: "55555555-5555-4555-8555-555555555555",
              siteId: "33333333-3333-4333-8333-333333333333",
              tenantId: "44444444-4444-4444-8444-444444444444",
              type: "SITE",
            },
          },
          userId: "invalid",
        },
      }),
    ).rejects.toThrow("INVALID_ID");
    expect(list).not.toHaveBeenCalled();
  });
});
