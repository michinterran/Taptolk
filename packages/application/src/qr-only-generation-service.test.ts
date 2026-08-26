import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import {
  type QrOnlyGenerationRepository,
  QrOnlyGenerationService,
} from "./qr-only-generation-service.js";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "00000000-0000-4000-8000-000000000002",
  site: "00000000-0000-4000-8000-000000000003",
} as const;

const authorization: AdminAuthorizationContext = {
  mfaVerified: true,
  role: "SUPER_ADMIN",
  scope: { type: "PLATFORM" },
};

function repository(): QrOnlyGenerationRepository {
  return {
    request: vi.fn().mockResolvedValue({
      batches: [],
      requestId: "00000000-0000-4000-8000-000000000004",
      siteId: IDS.site,
      totalQuantity: 10,
    }),
  };
}

describe("QrOnlyGenerationService", () => {
  it("validates the QR-only request and delegates without creating a job", async () => {
    const repo = repository();
    const result = await new QrOnlyGenerationService(repo).request({
      actor: { authorization, userId: IDS.actor },
      expectedSiteVersion: 2,
      idempotencyKey: IDS.idempotencyKey,
      quantity: 10,
      reason: "신규 사이트 QR 발행",
      siteId: IDS.site,
    });

    expect(result.totalQuantity).toBe(10);
    expect(repo.request).toHaveBeenCalledWith({
      expectedSiteVersion: 2,
      idempotencyKey: IDS.idempotencyKey,
      quantity: 10,
      reason: "신규 사이트 QR 발행",
      siteId: IDS.site,
    });
  });

  it.each<[string, Partial<{ expectedSiteVersion: number; quantity: number; reason: string }>]>([
    ["INVALID_QUANTITY", { quantity: 0 }],
    ["INVALID_REASON", { reason: " " }],
    ["INVALID_VERSION", { expectedSiteVersion: 0 }],
  ])("rejects %s before repository access", async (code, override) => {
    const repo = repository();
    await expect(
      new QrOnlyGenerationService(repo).request({
        actor: { authorization, userId: IDS.actor },
        expectedSiteVersion: override.expectedSiteVersion ?? 1,
        idempotencyKey: IDS.idempotencyKey,
        quantity: override.quantity ?? 10,
        reason: override.reason ?? "신규 사이트 QR 발행",
        siteId: IDS.site,
      }),
    ).rejects.toMatchObject({ code });
    expect(repo.request).not.toHaveBeenCalled();
  });
});
