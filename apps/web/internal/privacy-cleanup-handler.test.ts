import { describe, expect, it, vi } from "vitest";
import type { PrivacyCleanupHandlerDependencies } from "./privacy-cleanup-handler";
import { handlePrivacyCleanupRequest } from "./privacy-cleanup-handler";

const configuration = {
  blockGraceHours: 0,
  cronSecret: "staging-cron-secret-value-123456789",
  messageRetentionHours: 72,
  tokenGraceHours: 0,
};
const input = {
  authorizationHeader: `Bearer ${configuration.cronSecret}`,
  requestId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
};

function dependencies(): PrivacyCleanupHandlerDependencies {
  return {
    readConfiguration: vi.fn(() => configuration),
    run: vi.fn(async () => ({
      expiredSessionCount: 1,
      redactedMessageCount: 1,
      revokedBlockCount: 1,
      revokedTokenCount: 1,
      runId: "33333333-3333-4333-8333-333333333333",
      status: "SUCCESS" as const,
    })),
  };
}

describe("privacy cleanup HTTP policy", () => {
  it("rejects an invalid Cron bearer before cleanup", async () => {
    const target = dependencies();
    const result = await handlePrivacyCleanupRequest(
      { ...input, authorizationHeader: "Bearer invalid-value-long-enough-123" },
      target,
    );
    expect(result.status).toBe(401);
    expect(target.run).not.toHaveBeenCalled();
  });

  it("returns aggregate counts without the Cron secret", async () => {
    const result = await handlePrivacyCleanupRequest(input, dependencies());
    expect(result).toMatchObject({
      body: { data: { status: "SUCCESS" } },
      status: 200,
    });
    expect(JSON.stringify(result)).not.toContain(configuration.cronSecret);
  });
});
