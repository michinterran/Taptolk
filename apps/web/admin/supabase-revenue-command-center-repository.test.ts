import { describe, expect, it } from "vitest";
import { mapRevenueCommandCenterModel } from "./revenue-command-center-model";

describe("revenue command center read model", () => {
  it("derives aggregate totals from the server-authorized company rows", () => {
    const model = mapRevenueCommandCenterModel({
      active_qr_count: 99,
      companies: [
        {
          active_qr_count: 3,
          completed_batch_count: 2,
          id: "11111111-1111-4111-8111-111111111111",
          monthly_unit_price_krw: 1000,
          name: "Taptolk 직영",
          produced_sticker_count: 200,
          projected_monthly_revenue_krw: 3000,
          site_count: 4,
          tenant_id: "22222222-2222-4222-8222-222222222222",
        },
      ],
      completed_batch_count: 99,
      fresh_at: "2026-07-30T12:00:00.000Z",
      management_company_count: 99,
      priced_company_count: 99,
      produced_sticker_count: 9999,
      projected_monthly_revenue_krw: 9999,
      site_count: 99,
    });

    expect(model.companies.map((company) => company.name)).toEqual(["Taptolk 직영"]);
    expect(model).toMatchObject({
      activeQrCount: 3,
      completedBatchCount: 2,
      managementCompanyCount: 1,
      pricedCompanyCount: 1,
      producedStickerCount: 200,
      projectedMonthlyRevenueKrw: 3000,
      siteCount: 4,
    });
  });
});
