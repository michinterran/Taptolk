import "server-only";

import type {
  SolapiAccountHealthRepository,
  SolapiDeliveryOutcome,
  SolapiDeliveryReportRepository,
} from "@taptolk/application";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SOLAPI_OPERATIONS_REPOSITORY_UNAVAILABLE");
  }
  return value as Record<string, unknown>;
}

function outcome(value: unknown): SolapiDeliveryOutcome {
  if (value === "DELIVERED" || value === "FAILED" || value === "PENDING") {
    return value;
  }
  throw new Error("SOLAPI_OPERATIONS_REPOSITORY_UNAVAILABLE");
}

function assertResult(result: { data: unknown; error: unknown }): unknown {
  if (result.error) {
    throw new Error("SOLAPI_OPERATIONS_REPOSITORY_UNAVAILABLE");
  }
  return result.data;
}

export function createSupabaseSolapiDeliveryReportRepository(
  client: ServiceClient,
): SolapiDeliveryReportRepository {
  return {
    async recordBatch(reports) {
      const data = assertResult(
        await client.rpc("record_solapi_delivery_report_batch", {
          p_reports: reports,
        }),
      );
      if (!Array.isArray(data)) {
        throw new Error("SOLAPI_OPERATIONS_REPOSITORY_UNAVAILABLE");
      }
      return data.map((value) => {
        const result = row(value);
        if (typeof result.matched !== "boolean") {
          throw new Error("SOLAPI_OPERATIONS_REPOSITORY_UNAVAILABLE");
        }
        return { matched: result.matched, outcome: outcome(result.outcome) };
      });
    },
  };
}

export function createSupabaseSolapiAccountHealthRepository(
  client: ServiceClient,
): SolapiAccountHealthRepository {
  return {
    async recordChecked(input) {
      assertResult(
        await client.rpc("record_solapi_account_health", {
          p_auto_recharge_enabled: input.autoRechargeEnabled,
          p_balance_amount: input.balanceAmount,
          p_check_status: "CHECKED",
          p_error_code: null,
          p_low_balance_alert_enabled: input.lowBalanceAlertEnabled,
          p_point_amount: input.pointAmount,
          p_source: input.source,
          p_warning_threshold_amount: input.warningThresholdAmount,
        }),
      );
    },
    async recordUnavailable(input) {
      assertResult(
        await client.rpc("record_solapi_account_health", {
          p_auto_recharge_enabled: null,
          p_balance_amount: null,
          p_check_status: "UNAVAILABLE",
          p_error_code: input.errorCode,
          p_low_balance_alert_enabled: null,
          p_point_amount: null,
          p_source: input.source,
          p_warning_threshold_amount: input.warningThresholdAmount,
        }),
      );
    },
  };
}
