import { describe, expect, it, vi } from "vitest";
import {
  type QrOperationsReadModelRepository,
  QrOperationsReadModelService,
} from "./qr-operations-read-model-service.js";

const userId = "11111111-1111-4111-8111-111111111111";

function repository(): QrOperationsReadModelRepository {
  return {
    read: vi.fn(async () => ({
      batches: [],
      companies: [],
      sites: [],
      totals: {
        activeQr: 0,
        completedBatches: 0,
        generatedQr: 0,
        pendingActivationQr: 0,
        siteCount: 0,
        totalBatches: 0,
        totalCompanies: 0,
        totalQr: 0,
      },
    })),
  };
}

describe("QrOperationsReadModelService", () => {
  it("authorizes QR operations read access before returning the shared model", async () => {
    const repo = repository();
    const service = new QrOperationsReadModelService(repo);

    const result = await service.read({
      actor: {
        authorization: {
          mfaVerified: true,
          role: "SUPER_ADMIN",
          scope: { type: "PLATFORM" },
        },
        userId,
      },
    });

    expect(result.totals.totalQr).toBe(0);
    expect(repo.read).toHaveBeenCalledOnce();
  });

  it("rejects invalid actors before repository access", async () => {
    const repo = repository();
    const service = new QrOperationsReadModelService(repo);

    await expect(
      service.read({
        actor: {
          authorization: {
            mfaVerified: true,
            role: "SUPER_ADMIN",
            scope: { type: "PLATFORM" },
          },
          userId: "invalid",
        },
      }),
    ).rejects.toThrow("INVALID_ID");
    expect(repo.read).not.toHaveBeenCalled();
  });
});
