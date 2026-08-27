import { describe, expect, it, vi } from "vitest";
import {
  type RevenueCommandCenterRepository,
  RevenueCommandCenterService,
} from "./revenue-command-center-service.js";

const actor = {
  authorization: {
    mfaVerified: false,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: "11111111-1111-4111-8111-111111111111",
};

describe("RevenueCommandCenterService", () => {
  it("authorizes and reads the platform revenue model", async () => {
    const repository: RevenueCommandCenterRepository = {
      read: vi.fn(async () => ({
        activeQrCount: 0,
        companies: [],
        completedBatchCount: 0,
        freshAt: "2026-07-21T00:00:00.000Z",
        managementCompanyCount: 0,
        pricedCompanyCount: 0,
        producedStickerCount: 0,
        projectedMonthlyRevenueKrw: 0,
        siteCount: 0,
      })),
      setMonthlyUnitPrice: vi.fn(),
    };
    await expect(
      new RevenueCommandCenterService(repository).read({ actor }),
    ).resolves.toMatchObject({
      managementCompanyCount: 0,
    });
  });

  it("validates and forwards a versioned price command", async () => {
    const repository: RevenueCommandCenterRepository = {
      read: vi.fn(),
      setMonthlyUnitPrice: vi.fn(),
    };
    await new RevenueCommandCenterService(repository).setMonthlyUnitPrice({
      actor,
      effectiveFrom: "2026-08-01",
      managementCompanyId: "22222222-2222-4222-8222-222222222222",
      monthlyUnitPriceKrw: 1000,
      reason: "Pilot contract rate",
      requestId: "33333333-3333-4333-8333-333333333333",
      tenantId: "44444444-4444-4444-8444-444444444444",
    });
    expect(repository.setMonthlyUnitPrice).toHaveBeenCalledOnce();
  });
});
