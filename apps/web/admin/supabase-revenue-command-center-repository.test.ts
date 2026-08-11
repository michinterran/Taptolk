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

  it("does not expose legacy fixture company rows when the remote RPC omits the flag", () => {
    const model = mapRevenueCommandCenterModel({
      companies: [
        {
          active_qr_count: 10,
          completed_batch_count: 0,
          id: "11111111-1111-4111-8111-111111111111",
          monthly_unit_price_krw: null,
          name: "Taptolk E2E 02bd Company A",
          produced_sticker_count: 0,
          projected_monthly_revenue_krw: 0,
          site_count: 1,
          tenant_id: "22222222-2222-4222-8222-222222222222",
        },
        {
          active_qr_count: 1,
          completed_batch_count: 0,
          id: "33333333-3333-4333-8333-333333333333",
          monthly_unit_price_krw: null,
          name: "Taptolk 직영",
          produced_sticker_count: 0,
          projected_monthly_revenue_krw: 0,
          site_count: 1,
          tenant_id: "44444444-4444-4444-8444-444444444444",
        },
      ],
      fresh_at: "2026-07-30T12:00:00.000Z",
    });

    expect(model.companies.map((item) => item.name)).toEqual(["Taptolk 직영"]);
  });
});
