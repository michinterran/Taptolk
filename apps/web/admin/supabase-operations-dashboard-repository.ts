import "server-only";

import type {
  OperationsDailyPoint,
  OperationsDashboardModel,
  OperationsDashboardRepository,
  OperationsSitePerformance,
  SolapiOperationsHealthModel,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const FIXTURE_MARKERS = [/^taptolk e2e\b/iu, /\btaptolk-e2e-/iu, /^demo-/iu, /^\[데모\]/u];

function isFixtureText(value: string | null): boolean {
  return value !== null && FIXTURE_MARKERS.some((marker) => marker.test(value));
}

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

function mapDailySeries(value: unknown): readonly OperationsDailyPoint[] {
  if (!Array.isArray(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
    }
    const row = item as Record<string, unknown>;
    if (typeof row.date !== "string") {
      throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
    }
    return {
      contactCount: mapNumber(row, "contact_count"),
      date: row.date,
      escalatedCount: mapNumber(row, "escalated_count"),
      notificationFailedCount: mapNumber(row, "notification_failed_count"),
      notificationSentCount: mapNumber(row, "notification_sent_count"),
      unresolvedCount: mapNumber(row, "unresolved_count"),
    };
  });
}

function mapSitePerformance(value: unknown): readonly OperationsSitePerformance[] {
  if (!Array.isArray(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
      }
      const row = item as Record<string, unknown>;
      if (typeof row.site_id !== "string" || typeof row.site_name !== "string") {
        throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
      }
      return {
        activeQrCount: mapNumber(row, "active_qr_count"),
        contactCount: mapNumber(row, "contact_count"),
        siteId: row.site_id,
        siteName: row.site_name,
        unresolvedCount: mapNumber(row, "unresolved_count"),
      };
    })
    .filter((site) => !isFixtureText(site.siteName));
}

function mapOperationsDashboard(value: unknown): OperationsDashboardModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.fresh_at !== "string") {
    throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
  }
  const sitePerformance = mapSitePerformance(row.site_performance);
  const scopeManagementCompanyName = mapNullableString(row.scope_management_company_name);
  const scopeSiteName = mapNullableString(row.scope_site_name);
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
    siteCount: sitePerformance.length,
    unresolvedCount: mapNumber(row, "unresolved_count"),
    dailySeries: mapDailySeries(row.daily_series),
    scopeManagementCompanyName: isFixtureText(scopeManagementCompanyName)
      ? null
      : scopeManagementCompanyName,
    scopeSiteName: isFixtureText(scopeSiteName) ? null : scopeSiteName,
    sitePerformance,
    windowDays: mapNumber(row, "window_days"),
  };
}

function mapNullableBoolean(value: unknown): boolean | null {
  if (value === null) return null;
  if (typeof value !== "boolean") throw new Error("SOLAPI_OPERATIONS_HEALTH_UNAVAILABLE");
  return value;
}

function mapSolapiOperationsHealth(value: unknown): SolapiOperationsHealthModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SOLAPI_OPERATIONS_HEALTH_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  const balanceStatus = row.balance_status;
  if (
    typeof row.fresh_at !== "string" ||
    !["HEALTHY", "HIDDEN", "LOW", "STALE", "UNAVAILABLE"].includes(String(balanceStatus)) ||
    typeof row.balance_visible !== "boolean"
  ) {
    throw new Error("SOLAPI_OPERATIONS_HEALTH_UNAVAILABLE");
  }
  return {
    balanceAmount: mapNullableNumber(row.balance_amount),
    balanceAutoRechargeEnabled: mapNullableBoolean(row.balance_auto_recharge_enabled),
    balanceCapturedAt: mapNullableString(row.balance_captured_at),
    balanceLowAlertEnabled: mapNullableBoolean(row.balance_low_alert_enabled),
    balanceStatus: balanceStatus as SolapiOperationsHealthModel["balanceStatus"],
    balanceVisible: row.balance_visible,
    balanceWarningThresholdAmount: mapNullableNumber(row.balance_warning_threshold_amount),
    deliveryDeliveredCount: mapNumber(row, "delivery_delivered_count"),
    deliveryFailedCount: mapNumber(row, "delivery_failed_count"),
    deliveryPendingReportCount: mapNumber(row, "delivery_pending_report_count"),
    freshAt: row.fresh_at,
    webhookLastReceivedAt: mapNullableString(row.webhook_last_received_at),
    webhookUnmatchedCount: mapNumber(row, "webhook_unmatched_count"),
  };
}

export function createSupabaseOperationsDashboardRepository(
  client: AdminServerClient,
): OperationsDashboardRepository {
  return {
    async read(scope) {
      const dashboardPromise =
        scope.startDate && scope.endDate
          ? await client.rpc("read_operations_command_center_by_range", {
              p_end_date: scope.endDate,
              p_management_company_id: scope.managementCompanyId ?? null,
              p_site_id: scope.siteId ?? null,
              p_start_date: scope.startDate,
            })
          : await client.rpc("read_operations_command_center", {
              p_days: scope.days ?? 14,
              p_management_company_id: scope.managementCompanyId ?? null,
              p_site_id: scope.siteId ?? null,
            });
      const healthPromise = client.rpc("read_solapi_operations_health", {
        p_balance_stale_minutes: parseServerEnvironment().SOLAPI_BALANCE_STALE_MINUTES,
        p_management_company_id: scope.managementCompanyId ?? null,
        p_site_id: scope.siteId ?? null,
      });
      const [result, healthResult] = await Promise.all([dashboardPromise, healthPromise]);
      if (result.error) {
        throw new Error("OPERATIONS_DASHBOARD_UNAVAILABLE");
      }
      const dashboard = mapOperationsDashboard(result.data);
      return {
        ...dashboard,
        solapiHealth: healthResult.error ? null : mapSolapiOperationsHealth(healthResult.data),
      };
    },
  };
}
