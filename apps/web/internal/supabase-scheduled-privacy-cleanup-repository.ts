import "server-only";

import type {
  PrivacyCleanupResult,
  ScheduledPrivacyCleanupRepository,
  ScheduledPrivacyCleanupTenantResult,
} from "@taptolk/application";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function numberField(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number") {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return value;
}

function mapTenantResult(
  value: unknown,
): PrivacyCleanupResult | ScheduledPrivacyCleanupTenantResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (row.status !== "RUNNING" && row.status !== "SUCCESS") {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  const counts = {
    expiredSessionCount: numberField(row, "expired_session_count"),
    redactedMessageCount: numberField(row, "redacted_message_count"),
    revokedBlockCount: numberField(row, "revoked_block_count"),
    revokedTokenCount: numberField(row, "revoked_token_count"),
  };
  if (row.status === "RUNNING") {
    return { ...counts, status: "RUNNING" };
  }
  if (typeof row.run_id !== "string" || !UUID_PATTERN.test(row.run_id)) {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return { ...counts, runId: row.run_id, status: "SUCCESS" };
}

function mapTenantIds(value: unknown): readonly string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  const tenantIds = (value as Record<string, unknown>).tenant_ids;
  if (
    !Array.isArray(tenantIds) ||
    tenantIds.some((tenantId) => typeof tenantId !== "string" || !UUID_PATTERN.test(tenantId))
  ) {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return tenantIds;
}

export function createSupabaseScheduledPrivacyCleanupRepository(
  client: ServiceClient,
): ScheduledPrivacyCleanupRepository {
  return {
    async listDueTenantIds(input) {
      const result = await client.rpc("list_due_privacy_cleanup_tenants", {
        p_limit: input.limit,
      });
      if (result.error) {
        throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
      }
      return mapTenantIds(result.data);
    },
    async run(input) {
      const result = await client.rpc("run_privacy_cleanup", {
        p_block_grace_hours: input.blockGraceHours,
        p_message_retention_hours: input.messageRetentionHours,
        p_request_id: input.requestId,
        p_tenant_id: input.tenantId,
        p_token_grace_hours: input.tokenGraceHours,
      });
      if (result.error) {
        throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
      }
      return mapTenantResult(result.data);
    },
  };
}
