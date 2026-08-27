import { createHash } from "node:crypto";
import type { PrivacyCleanupResult } from "./operations-hardening-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REQUEST_NAMESPACE = "taptolk:scheduled-privacy-cleanup:v1";

export interface ScheduledPrivacyCleanupTenantResult {
  expiredSessionCount: number;
  redactedMessageCount: number;
  revokedBlockCount: number;
  revokedTokenCount: number;
  status: "RUNNING" | "SUCCESS";
}

export interface ScheduledPrivacyCleanupRepository {
  listDueTenantIds(input: { limit: number }): Promise<readonly string[]>;
  run(input: {
    blockGraceHours: number;
    messageRetentionHours: number;
    requestId: string;
    tenantId: string;
    tokenGraceHours: number;
  }): Promise<PrivacyCleanupResult | ScheduledPrivacyCleanupTenantResult>;
}

export interface ScheduledPrivacyCleanupClock {
  now(): Date;
}

export interface ScheduledPrivacyCleanupResult {
  deferredTenantCount: number;
  expiredSessionCount: number;
  failedTenantCount: number;
  inProgressTenantCount: number;
  processedTenantCount: number;
  redactedMessageCount: number;
  revokedBlockCount: number;
  revokedTokenCount: number;
  selectedTenantCount: number;
  status: "PARTIAL_FAILURE" | "SUCCESS";
}

const systemClock: ScheduledPrivacyCleanupClock = {
  now: () => new Date(),
};

function utcHour(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("INVALID_CLOCK");
  }
  const hour = new Date(date);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString();
}

export function scheduledPrivacyCleanupRequestId(input: {
  tenantId: string;
  windowStart: Date;
}): string {
  if (!UUID_PATTERN.test(input.tenantId)) {
    throw new Error("INVALID_ID");
  }
  const bytes = createHash("sha256")
    .update(`${REQUEST_NAMESPACE}:${input.tenantId}:${utcHour(input.windowStart)}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x80, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const value = bytes.toString("hex");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-");
}

function validatePolicy(input: {
  blockGraceHours: number;
  durationBudgetMs: number;
  messageRetentionHours: number;
  tenantLimit: number;
  tokenGraceHours: number;
}): void {
  if (
    !Number.isInteger(input.tenantLimit) ||
    input.tenantLimit < 1 ||
    input.tenantLimit > 100 ||
    !Number.isInteger(input.durationBudgetMs) ||
    input.durationBudgetMs < 1_000 ||
    input.durationBudgetMs > 55_000 ||
    !Number.isInteger(input.messageRetentionHours) ||
    input.messageRetentionHours < 24 ||
    input.messageRetentionHours > 8_760 ||
    !Number.isInteger(input.tokenGraceHours) ||
    input.tokenGraceHours < 0 ||
    input.tokenGraceHours > 168 ||
    !Number.isInteger(input.blockGraceHours) ||
    input.blockGraceHours < 0 ||
    input.blockGraceHours > 168
  ) {
    throw new Error("INVALID_SCHEDULED_CLEANUP_POLICY");
  }
}

export class ScheduledPrivacyCleanupService {
  constructor(
    private readonly repository: ScheduledPrivacyCleanupRepository,
    private readonly clock: ScheduledPrivacyCleanupClock = systemClock,
  ) {}

  async run(input: {
    blockGraceHours: number;
    durationBudgetMs: number;
    messageRetentionHours: number;
    tenantLimit: number;
    tokenGraceHours: number;
  }): Promise<ScheduledPrivacyCleanupResult> {
    validatePolicy(input);
    const startedAt = this.clock.now();
    const tenantIds = [...(await this.repository.listDueTenantIds({ limit: input.tenantLimit }))];
    if (
      tenantIds.length > input.tenantLimit ||
      new Set(tenantIds).size !== tenantIds.length ||
      tenantIds.some((tenantId) => !UUID_PATTERN.test(tenantId))
    ) {
      throw new Error("INVALID_SCHEDULED_CLEANUP_REPOSITORY_RESULT");
    }

    const result: ScheduledPrivacyCleanupResult = {
      deferredTenantCount: 0,
      expiredSessionCount: 0,
      failedTenantCount: 0,
      inProgressTenantCount: 0,
      processedTenantCount: 0,
      redactedMessageCount: 0,
      revokedBlockCount: 0,
      revokedTokenCount: 0,
      selectedTenantCount: tenantIds.length,
      status: "SUCCESS",
    };

    for (const tenantId of tenantIds) {
      if (this.clock.now().getTime() - startedAt.getTime() >= input.durationBudgetMs) {
        break;
      }
      result.processedTenantCount += 1;
      try {
        const tenantResult = await this.repository.run({
          blockGraceHours: input.blockGraceHours,
          messageRetentionHours: input.messageRetentionHours,
          requestId: scheduledPrivacyCleanupRequestId({
            tenantId,
            windowStart: startedAt,
          }),
          tenantId,
          tokenGraceHours: input.tokenGraceHours,
        });
        if (tenantResult.status === "RUNNING") {
          result.inProgressTenantCount += 1;
          continue;
        }
        result.expiredSessionCount += tenantResult.expiredSessionCount;
        result.redactedMessageCount += tenantResult.redactedMessageCount;
        result.revokedBlockCount += tenantResult.revokedBlockCount;
        result.revokedTokenCount += tenantResult.revokedTokenCount;
      } catch {
        result.failedTenantCount += 1;
      }
    }

    result.deferredTenantCount = result.selectedTenantCount - result.processedTenantCount;
    result.status = result.failedTenantCount > 0 ? "PARTIAL_FAILURE" : "SUCCESS";
    return result;
  }
}
