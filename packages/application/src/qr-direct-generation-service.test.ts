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
  it("accepts canonical UUIDs for the site, idempotency key, and actor", async () => {
    const repo = repository();

    const result = await new QrDirectGenerationService(repo).request({
      actor: { authorization, userId: IDS.actor },
      expectedSiteVersion: 1,
      idempotencyKey: IDS.idempotencyKey,
      quantity: 10,
      reason: "Admin direct generation request",
      siteId: IDS.site,
    });

    expect(result.requestId).toBe(IDS.request);
    expect(repo.request).toHaveBeenCalledWith({
      expectedSiteVersion: 1,
      idempotencyKey: IDS.idempotencyKey,
      quantity: 10,
      reason: "Admin direct generation request",
      siteId: IDS.site,
    });
  });
});
