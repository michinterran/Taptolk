import "server-only";

import type { RevenueCommandCenterRepository } from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";
import { mapRevenueCommandCenterModel } from "./revenue-command-center-model";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export function createSupabaseRevenueCommandCenterRepository(
  client: AdminServerClient,
): RevenueCommandCenterRepository {
  return {
    async read() {
      const result = await client.rpc("read_revenue_command_center");
      if (result.error) throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
      return mapRevenueCommandCenterModel(result.data);
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
