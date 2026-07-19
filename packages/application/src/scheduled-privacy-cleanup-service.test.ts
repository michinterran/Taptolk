import { describe, expect, it, vi } from "vitest";
import {
  type ScheduledPrivacyCleanupClock,
  type ScheduledPrivacyCleanupRepository,
  ScheduledPrivacyCleanupService,
  scheduledPrivacyCleanupRequestId,
} from "./scheduled-privacy-cleanup-service.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

function success() {
  return {
    expiredSessionCount: 1,
    redactedMessageCount: 2,
    revokedBlockCount: 3,
    revokedTokenCount: 4,
    runId: "33333333-3333-4333-8333-333333333333",
    status: "SUCCESS" as const,
  };
}

describe("scheduled privacy cleanup request identity", () => {
  it("is stable inside one UTC hour and changes for the next hour", () => {
    const first = scheduledPrivacyCleanupRequestId({
      tenantId: TENANT_A,
      windowStart: new Date("2026-07-20T04:01:00.000Z"),
    });
    expect(first).toBe(
      scheduledPrivacyCleanupRequestId({
        tenantId: TENANT_A,
        windowStart: new Date("2026-07-20T04:59:59.999Z"),
      }),
    );
    expect(first).not.toBe(
      scheduledPrivacyCleanupRequestId({
        tenantId: TENANT_A,
        windowStart: new Date("2026-07-20T05:00:00.000Z"),
      }),
    );
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });
});

describe("ScheduledPrivacyCleanupService", () => {
  it("runs due tenants with deterministic IDs and returns aggregate counts only", async () => {
    const repository: ScheduledPrivacyCleanupRepository = {
      listDueTenantIds: vi.fn(async () => [TENANT_A, TENANT_B]),
      run: vi.fn().mockResolvedValueOnce(success()).mockResolvedValueOnce({
        expiredSessionCount: 0,
        redactedMessageCount: 0,
        revokedBlockCount: 0,
        revokedTokenCount: 0,
        status: "RUNNING",
      }),
    };
    const now = new Date("2026-07-20T04:15:00.000Z");
    const result = await new ScheduledPrivacyCleanupService(repository, {
      now: () => now,
    }).run({
      blockGraceHours: 0,
      durationBudgetMs: 45_000,
      messageRetentionHours: 72,
      tenantLimit: 25,
      tokenGraceHours: 0,
    });

    expect(result).toEqual({
      deferredTenantCount: 0,
      expiredSessionCount: 1,
      failedTenantCount: 0,
      inProgressTenantCount: 1,
      processedTenantCount: 2,
      redactedMessageCount: 2,
      revokedBlockCount: 3,
      revokedTokenCount: 4,
      selectedTenantCount: 2,
      status: "SUCCESS",
    });
    expect(repository.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        requestId: scheduledPrivacyCleanupRequestId({ tenantId: TENANT_A, windowStart: now }),
        tenantId: TENANT_A,
      }),
    );
    expect(JSON.stringify(result)).not.toContain(TENANT_A);
  });

  it("continues after one tenant failure and reports a partial failure", async () => {
    const repository: ScheduledPrivacyCleanupRepository = {
      listDueTenantIds: vi.fn(async () => [TENANT_A, TENANT_B]),
      run: vi
        .fn()
        .mockRejectedValueOnce(new Error("upstream detail"))
        .mockResolvedValueOnce(success()),
    };
    const result = await new ScheduledPrivacyCleanupService(repository, {
      now: () => new Date("2026-07-20T04:15:00.000Z"),
    }).run({
      blockGraceHours: 0,
      durationBudgetMs: 45_000,
      messageRetentionHours: 72,
      tenantLimit: 25,
      tokenGraceHours: 0,
    });
    expect(result).toMatchObject({
      failedTenantCount: 1,
      processedTenantCount: 2,
      status: "PARTIAL_FAILURE",
    });
    expect(repository.run).toHaveBeenCalledTimes(2);
  });

  it("defers remaining tenants when the duration budget is exhausted", async () => {
    const moments = [
      new Date("2026-07-20T04:00:00.000Z"),
      new Date("2026-07-20T04:00:00.500Z"),
      new Date("2026-07-20T04:00:01.000Z"),
    ];
    const clock: ScheduledPrivacyCleanupClock = {
      now: vi.fn(() => moments.shift() ?? new Date("2026-07-20T04:00:01.000Z")),
    };
    const repository: ScheduledPrivacyCleanupRepository = {
      listDueTenantIds: vi.fn(async () => [TENANT_A, TENANT_B]),
      run: vi.fn(async () => success()),
    };
    const result = await new ScheduledPrivacyCleanupService(repository, clock).run({
      blockGraceHours: 0,
      durationBudgetMs: 1_000,
      messageRetentionHours: 72,
      tenantLimit: 25,
      tokenGraceHours: 0,
    });
    expect(result).toMatchObject({
      deferredTenantCount: 1,
      processedTenantCount: 1,
      selectedTenantCount: 2,
    });
    expect(repository.run).toHaveBeenCalledOnce();
  });

  it("rejects unsafe policy and malformed repository output before cleanup", async () => {
    const repository: ScheduledPrivacyCleanupRepository = {
      listDueTenantIds: vi.fn(async () => [TENANT_A, TENANT_A]),
      run: vi.fn(),
    };
    const service = new ScheduledPrivacyCleanupService(repository);
    await expect(
      service.run({
        blockGraceHours: 0,
        durationBudgetMs: 999,
        messageRetentionHours: 72,
        tenantLimit: 25,
        tokenGraceHours: 0,
      }),
    ).rejects.toThrow("INVALID_SCHEDULED_CLEANUP_POLICY");
    await expect(
      service.run({
        blockGraceHours: 0,
        durationBudgetMs: 1_000,
        messageRetentionHours: 72,
        tenantLimit: 25,
        tokenGraceHours: 0,
      }),
    ).rejects.toThrow("INVALID_SCHEDULED_CLEANUP_REPOSITORY_RESULT");
    expect(repository.run).not.toHaveBeenCalled();
  });
});
