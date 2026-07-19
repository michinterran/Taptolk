import "server-only";

import type { PrivacyCleanupRepository, PrivacyCleanupResult } from "@taptolk/application";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

function numberField(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number") {
    throw new Error("PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return value;
}

function mapResult(value: unknown): PrivacyCleanupResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PRIVACY_CLEANUP_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.run_id !== "string" || row.status !== "SUCCESS") {
    throw new Error("PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return {
    expiredSessionCount: numberField(row, "expired_session_count"),
    redactedMessageCount: numberField(row, "redacted_message_count"),
    revokedBlockCount: numberField(row, "revoked_block_count"),
    revokedTokenCount: numberField(row, "revoked_token_count"),
    runId: row.run_id,
    status: "SUCCESS",
  };
}

export function createSupabasePrivacyCleanupRepository(
  client: ServiceClient,
): PrivacyCleanupRepository {
  return {
    async run(input) {
      const result = await client.rpc("run_privacy_cleanup", {
        p_block_grace_hours: input.blockGraceHours,
        p_message_retention_hours: input.messageRetentionHours,
        p_request_id: input.requestId,
        p_tenant_id: input.tenantId,
        p_token_grace_hours: input.tokenGraceHours,
      });
      if (result.error) {
        throw new Error("PRIVACY_CLEANUP_UNAVAILABLE");
      }
      return mapResult(result.data);
    },
  };
}
