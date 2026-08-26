import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import {
  type QrDirectGenerationRepository,
  QrDirectGenerationService,
} from "./qr-direct-generation-service.js";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  batch: "00000000-0000-4000-8000-000000000002",
  job: "00000000-0000-4000-8000-000000000003",
  request: "00000000-0000-4000-8000-000000000004",
  site: "00000000-0000-4000-8000-000000000005",
  idempotencyKey: "00000000-0000-4000-8000-000000000006",
} as const;

const authorization: AdminAuthorizationContext = {
  mfaVerified: true,
  role: "SUPER_ADMIN",
  scope: { type: "PLATFORM" },
};

function repository(): QrDirectGenerationRepository {
  return {
    request: vi.fn().mockResolvedValue({
      batches: [
        {
          batchCode: "QR-2026-0001",
          batchId: IDS.batch,
          batchStatus: "REQUESTED",
          batchVersion: 1,
          generationRevision: 0,
          jobId: IDS.job,
          jobStatus: "PENDING",
          requestedQuantity: 10,
        },
      ],
      requestId: IDS.request,
      siteId: IDS.site,
      totalQuantity: 10,
    }),
  };
}

describe("QrDirectGenerationService", () => {
  it("rejects the legacy direct path until the independent approval flow is used", async () => {
    const repo = repository();

    await expect(
      new QrDirectGenerationService(repo).request({
        actor: { authorization, userId: IDS.actor },
        expectedSiteVersion: 1,
        idempotencyKey: IDS.idempotencyKey,
        quantity: 10,
        reason: "Admin direct generation request",
        siteId: IDS.site,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });

    expect(repo.request).not.toHaveBeenCalled();
  });
});
