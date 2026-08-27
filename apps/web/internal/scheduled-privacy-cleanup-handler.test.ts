import { describe, expect, it, vi } from "vitest";
import type { ScheduledPrivacyCleanupHandlerDependencies } from "./scheduled-privacy-cleanup-handler";
import { handleScheduledPrivacyCleanupRequest } from "./scheduled-privacy-cleanup-handler";

const CRON_SECRET = "scheduled-cron-secret-value-123456789";
const configuration = {
  blockGraceHours: 0,
  cronSecret: CRON_SECRET,
  durationBudgetMs: 45_000,
  messageRetentionHours: 72,
  tenantLimit: 25,
  tokenGraceHours: 0,
};
const input = {
  authorizationHeader: `Bearer ${CRON_SECRET}`,
  requestId: "11111111-1111-4111-8111-111111111111",
};
const success = {
  deferredTenantCount: 0,
  expiredSessionCount: 1,
  failedTenantCount: 0,
  inProgressTenantCount: 0,
  processedTenantCount: 1,
  redactedMessageCount: 1,
  revokedBlockCount: 1,
  revokedTokenCount: 1,
  selectedTenantCount: 1,
  status: "SUCCESS" as const,
};

function dependencies(): ScheduledPrivacyCleanupHandlerDependencies {
  return {
    readConfiguration: vi.fn(() => configuration),
    run: vi.fn(async () => success),
  };
}

describe("scheduled privacy cleanup HTTP policy", () => {
  it("fails closed before application work when configuration is absent", async () => {
    const target = dependencies();
    vi.mocked(target.readConfiguration).mockReturnValue(null);
    const result = await handleScheduledPrivacyCleanupRequest(input, target);
    expect(result.status).toBe(503);
    expect(target.run).not.toHaveBeenCalled();
  });

  it("rejects an invalid Cron bearer before application work", async () => {
    const target = dependencies();
    const result = await handleScheduledPrivacyCleanupRequest(
      { ...input, authorizationHeader: "Bearer invalid-value-long-enough-123" },
      target,
    );
    expect(result.status).toBe(401);
    expect(target.run).not.toHaveBeenCalled();
  });

  it("returns aggregate counts without secret or tenant identity", async () => {
    const result = await handleScheduledPrivacyCleanupRequest(input, dependencies());
    expect(result).toMatchObject({
      body: { data: { status: "SUCCESS" } },
      status: 200,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CRON_SECRET);
    expect(serialized).not.toMatch(/tenantId|tenant_id/iu);
  });

  it("keeps aggregate evidence while making partial failure observable", async () => {
    const target = dependencies();
    vi.mocked(target.run).mockResolvedValue({
      ...success,
      failedTenantCount: 1,
      status: "PARTIAL_FAILURE",
    });
    const result = await handleScheduledPrivacyCleanupRequest(input, target);
    expect(result).toMatchObject({
      body: {
        data: { failedTenantCount: 1 },
        error: { code: "PARTIAL_FAILURE", retryable: true },
      },
      status: 500,
    });
  });

  it("reduces runtime failure without upstream detail", async () => {
    const target = dependencies();
    vi.mocked(target.run).mockRejectedValue(new Error("database and tenant detail"));
    const result = await handleScheduledPrivacyCleanupRequest(input, target);
    expect(result.status).toBe(500);
    expect(JSON.stringify(result)).not.toContain("database and tenant detail");
  });
});
