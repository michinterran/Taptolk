"use server";

import { AdminDirectoryService } from "@taptolk/application";
import type { AdminRole, AdminScopeType } from "@taptolk/domain";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createAdminServiceClient } from "../auth/service-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { createSupabaseAdminDirectoryRepository } from "./supabase-admin-directory-repository";

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateAdminDirectoryMembership(formData: FormData): Promise<never> {
  const localeValue = read(formData, "locale");
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "en";
  const path = `/${locale}/admin/accounts` as Route;
  try {
    const context = await requireReadyAdminContext(locale);
    const sessionClient = await createAdminServerClient();
    const serviceClient = createAdminServiceClient();
    if (!sessionClient || !serviceClient) throw new Error("ADMIN_DIRECTORY_UNAVAILABLE");
    const scopeType = read(formData, "scopeType") as AdminScopeType;
    const tenantId = read(formData, "tenantId");
    const managementCompanyId = read(formData, "managementCompanyId");
    const siteId = read(formData, "siteId");
    await new AdminDirectoryService(
      createSupabaseAdminDirectoryRepository(sessionClient, serviceClient),
    ).update({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      expectedVersion: Number(read(formData, "expectedVersion")),
      membershipId: read(formData, "membershipId"),
      reason: read(formData, "reason"),
      requestId: crypto.randomUUID(),
      role: read(formData, "role") as AdminRole,
      scope: {
        type: scopeType,
        ...(tenantId ? { tenantId } : {}),
        ...(managementCompanyId ? { managementCompanyId } : {}),
        ...(siteId ? { siteId } : {}),
      },
      status: read(formData, "status") as "ACTIVE" | "REVOKED" | "SUSPENDED",
    });
  } catch {
    redirect(`${path}?error=update` as Route);
  }
  redirect(`${path}?status=updated` as Route);
}
