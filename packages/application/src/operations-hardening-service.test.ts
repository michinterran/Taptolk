import { describe, expect, it, vi } from "vitest";
import type {
  OperationsDashboardRepository,
  PrivacyCleanupRepository,
} from "./operations-hardening-service.js";
import {
  OperationsDashboardService,
  PrivacyCleanupService,
} from "./operations-hardening-service.js";

const authorization = {
  mfaVerified: true,
  role: "SITE_ADMIN" as const,
  scope: {
    managementCompanyId: "66666666-6666-4666-8666-666666666666",
    siteId: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    type: "SITE" as const,
  },
};

describe("OperationsDashboardService", () => {
  it("authorizes audit visibility before reading the scoped model", async () => {
    const repository: OperationsDashboardRepository = {
      read: vi.fn(async () => ({
        activeBlockCount: 0,
        activeQrCount: 1,
        completedBatchCount: 10,
        contactCount: 3,
        escalatedCount: 1,
        freshAt: "2026-07-20T04:00:00.000Z",
        latestSnapshotAt: null,
        medianOwnerResponseMs: 2_000,
        notificationFailedCount: 0,
        notificationMissingCostCount: 1,
        notificationRecordedCost: 0,
        notificationRetryCount: 0,
        notificationSentCount: 2,
        openReportCount: 0,
        siteCount: 1,
        unresolvedCount: 1,
      })),
    };
    await new OperationsDashboardService(repository).read({
      actor: {
        authorization,
        userId: "33333333-3333-4333-8333-333333333333",
      },
    });
    expect(repository.read).toHaveBeenCalledOnce();
  });
});

describe("PrivacyCleanupService", () => {
  it("accepts a bounded typed policy and returns counts only", async () => {
    const repository: PrivacyCleanupRepository = {
      run: vi.fn(async () => ({
        expiredSessionCount: 1,
        redactedMessageCount: 1,
        revokedBlockCount: 1,
        revokedTokenCount: 1,
        runId: "44444444-4444-4444-8444-444444444444",
        status: "SUCCESS" as const,
      })),
    };
    const result = await new PrivacyCleanupService(repository).run({
      blockGraceHours: 0,
      messageRetentionHours: 72,
      requestId: "55555555-5555-4555-8555-555555555555",
      tenantId: "11111111-1111-4111-8111-111111111111",
      tokenGraceHours: 0,
    });
    expect(result).toEqual(expect.objectContaining({ status: "SUCCESS" }));
    expect(repository.run).toHaveBeenCalledOnce();
  });

  it("rejects an unsafe retention value before repository access", async () => {
    const repository: PrivacyCleanupRepository = {
      run: vi.fn(),
    };
    await expect(
      new PrivacyCleanupService(repository).run({
        blockGraceHours: 0,
        messageRetentionHours: 1,
        requestId: "55555555-5555-4555-8555-555555555555",
        tenantId: "11111111-1111-4111-8111-111111111111",
        tokenGraceHours: 0,
      }),
    ).rejects.toThrow("INVALID_RETENTION_POLICY");
    expect(repository.run).not.toHaveBeenCalled();
  });
});
