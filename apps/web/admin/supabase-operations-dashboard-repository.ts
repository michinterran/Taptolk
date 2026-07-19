import "server-only";

import type { OperationsDashboardModel, OperationsDashboardRepository } from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

function mapNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return value;
}

function mapNullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return value;
}

function mapNumber(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return value;
}

function mapOperationsDashboard(value: unknown): OperationsDashboardModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.fresh_at !== "string") {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return {
    activeBlockCount: mapNumber(row, "active_block_count"),
    activeQrCount: mapNumber(row, "active_qr_count"),
    completedBatchCount: mapNumber(row, "completed_batch_count"),
    contactCount: mapNumber(row, "contact_count"),
    escalatedCount: mapNumber(row, "escalated_count"),
    freshAt: row.fresh_at,
    latestSnapshotAt: mapNullableString(row.latest_snapshot_at),
    medianOwnerResponseMs: mapNullableNumber(row.median_owner_response_ms),
    notificationFailedCount: mapNumber(row, "notification_failed_count"),
    notificationMissingCostCount: mapNumber(row, "notification_missing_cost_count"),
    notificationRecordedCost: mapNumber(row, "notification_recorded_cost"),
    notificationRetryCount: mapNumber(row, "notification_retry_count"),
    notificationSentCount: mapNumber(row, "notification_sent_count"),
    openReportCount: mapNumber(row, "open_report_count"),
    siteCount: mapNumber(row, "site_count"),
    unresolvedCount: mapNumber(row, "unresolved_count"),
  };
}

export function createSupabaseOperationsDashboardRepository(
  client: AdminServerClient,
): OperationsDashboardRepository {
  return {
    async read() {
      const result = await client.rpc("read_operations_dashboard");
      if (result.error) {
        throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
      }
      return mapOperationsDashboard(result.data);
    },
  };
}
