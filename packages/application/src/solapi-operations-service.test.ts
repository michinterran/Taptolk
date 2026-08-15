import { describe, expect, it, vi } from "vitest";
import {
  type SolapiAccountHealthRepository,
  SolapiAccountHealthService,
  type SolapiDeliveryReportRepository,
  SolapiDeliveryReportService,
} from "./solapi-operations-service.js";

describe("SolapiDeliveryReportService", () => {
  it("records redacted delivery reports and returns aggregate counts only", async () => {
    const repository: SolapiDeliveryReportRepository = {
      recordBatch: vi.fn().mockResolvedValue([
        { matched: true, outcome: "DELIVERED" },
        { matched: false, outcome: "FAILED" },
      ]),
    };
    const result = await new SolapiDeliveryReportService(repository).recordBatch([
      {
        idempotencyKey: "a".repeat(64),
        providerMessageId: "message_12345678",
        providerReceivedAt: "2026-08-15T01:00:01.000Z",
        providerReportedAt: "2026-08-15T01:00:02.000Z",
        statusCode: "4000",
      },
      {
        idempotencyKey: null,
        providerMessageId: "message_87654321",
        providerReceivedAt: null,
        providerReportedAt: "2026-08-15T01:00:03.000Z",
        statusCode: "3040",
      },
    ]);

    expect(result).toEqual({
      delivered: 1,
      failed: 1,
      matched: 1,
      pending: 0,
      received: 2,
      unmatched: 1,
    });
  });
});

describe("SolapiAccountHealthService", () => {
  it("stores a checked balance without account or payment identifiers", async () => {
    const repository: SolapiAccountHealthRepository = {
      recordChecked: vi.fn(),
      recordUnavailable: vi.fn(),
    };
    const result = await new SolapiAccountHealthService(repository, {
      read: vi.fn().mockResolvedValue({
        autoRechargeEnabled: false,
        balanceAmount: 3_000,
        lowBalanceAlertEnabled: true,
        pointAmount: 100,
      }),
    }).capture({ source: "CRON", warningThresholdAmount: 5_000 });

    expect(result).toMatchObject({ balanceAmount: 3_000, status: "CHECKED" });
    expect(repository.recordChecked).toHaveBeenCalledWith(
      expect.objectContaining({ source: "CRON", warningThresholdAmount: 5_000 }),
    );
    expect(repository.recordUnavailable).not.toHaveBeenCalled();
  });

  it("records a redacted unavailable state when the provider cannot be read", async () => {
    const repository: SolapiAccountHealthRepository = {
      recordChecked: vi.fn(),
      recordUnavailable: vi.fn(),
    };
    const result = await new SolapiAccountHealthService(repository, {
      read: vi.fn().mockRejectedValue(new Error("provider detail must not escape")),
    }).capture({ source: "WEBHOOK", warningThresholdAmount: 5_000 });

    expect(result).toEqual({ status: "UNAVAILABLE" });
    expect(repository.recordUnavailable).toHaveBeenCalledWith({
      errorCode: "PROVIDER_UNAVAILABLE",
      source: "WEBHOOK",
      warningThresholdAmount: 5_000,
    });
  });
});
