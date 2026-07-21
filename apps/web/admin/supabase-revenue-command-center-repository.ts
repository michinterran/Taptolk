import "server-only";

import type {
  RevenueCommandCenterModel,
  RevenueCommandCenterRepository,
  RevenueCompanyItem,
} from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

function number(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  return value;
}

function company(value: unknown): RevenueCompanyItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.name !== "string"
  ) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  return {
    activeQrCount: number(row, "active_qr_count"),
    completedBatchCount: number(row, "completed_batch_count"),
    id: row.id,
    monthlyUnitPriceKrw:
      row.monthly_unit_price_krw === null ? null : number(row, "monthly_unit_price_krw"),
    name: row.name,
    producedStickerCount: number(row, "produced_sticker_count"),
    projectedMonthlyRevenueKrw: number(row, "projected_monthly_revenue_krw"),
    siteCount: number(row, "site_count"),
    tenantId: row.tenant_id,
  };
}

function mapModel(value: unknown): RevenueCommandCenterModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.fresh_at !== "string" || !Array.isArray(row.companies)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  return {
    activeQrCount: number(row, "active_qr_count"),
    companies: row.companies.map(company),
    completedBatchCount: number(row, "completed_batch_count"),
    freshAt: row.fresh_at,
    managementCompanyCount: number(row, "management_company_count"),
    pricedCompanyCount: number(row, "priced_company_count"),
    producedStickerCount: number(row, "produced_sticker_count"),
    projectedMonthlyRevenueKrw: number(row, "projected_monthly_revenue_krw"),
    siteCount: number(row, "site_count"),
  };
}

export function createSupabaseRevenueCommandCenterRepository(
  client: AdminServerClient,
): RevenueCommandCenterRepository {
  return {
    async read() {
      const result = await client.rpc("read_revenue_command_center");
      if (result.error) throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
      return mapModel(result.data);
    },
    async setMonthlyUnitPrice(input) {
      const result = await client.rpc("set_management_company_monthly_unit_price", {
        p_effective_from: input.effectiveFrom,
        p_management_company_id: input.managementCompanyId,
        p_monthly_unit_price_krw: input.monthlyUnitPriceKrw,
        p_reason: input.reason,
        p_request_id: input.requestId,
        p_tenant_id: input.tenantId,
      });
      if (result.error) throw new Error("REVENUE_PRICING_UPDATE_FAILED");
    },
  };
}
