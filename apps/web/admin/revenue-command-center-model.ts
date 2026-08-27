import type { RevenueCommandCenterModel, RevenueCompanyItem } from "@taptolk/application";

function number(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  return value;
}

function isFixtureCompany(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    row.is_test_fixture === true ||
    (typeof row.name === "string" && /^Taptolk E2E\b/iu.test(row.name))
  );
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

export function mapRevenueCommandCenterModel(value: unknown): RevenueCommandCenterModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.fresh_at !== "string" || !Array.isArray(row.companies)) {
    throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
  }
  const companies = row.companies.filter((item) => !isFixtureCompany(item)).map(company);
  return {
    activeQrCount: companies.reduce((total, item) => total + item.activeQrCount, 0),
    companies,
    completedBatchCount: companies.reduce((total, item) => total + item.completedBatchCount, 0),
    freshAt: row.fresh_at,
    managementCompanyCount: companies.length,
    pricedCompanyCount: companies.filter((item) => item.monthlyUnitPriceKrw !== null).length,
    producedStickerCount: companies.reduce((total, item) => total + item.producedStickerCount, 0),
    projectedMonthlyRevenueKrw: companies.reduce(
      (total, item) => total + item.projectedMonthlyRevenueKrw,
      0,
    ),
    siteCount: companies.reduce((total, item) => total + item.siteCount, 0),
  };
}
