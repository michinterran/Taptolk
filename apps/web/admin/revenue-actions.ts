"use server";

import { RevenueCommandCenterService } from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { createSupabaseRevenueCommandCenterRepository } from "./supabase-revenue-command-center-repository";

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function setMonthlyUnitPrice(formData: FormData): Promise<never> {
  const localeValue = read(formData, "locale");
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "en";
  const path = `/${locale}/admin/platform/revenue` as Route;
  try {
    const context = await requireReadyAdminContext(locale);
    const client = await createAdminServerClient();
    if (!client) throw new Error("REVENUE_COMMAND_CENTER_UNAVAILABLE");
    const service = new RevenueCommandCenterService(
      createSupabaseRevenueCommandCenterRepository(client),
    );
    await service.setMonthlyUnitPrice({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      effectiveFrom: read(formData, "effectiveFrom"),
      managementCompanyId: read(formData, "managementCompanyId"),
      monthlyUnitPriceKrw: Number(read(formData, "monthlyUnitPriceKrw")),
      reason: read(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: read(formData, "tenantId"),
    });
  } catch {
    redirect(`${path}?error=update` as Route);
  }
  redirect(`${path}?status=updated` as Route);
}
