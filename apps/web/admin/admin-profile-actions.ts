"use server";

import { AdminProfileService } from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { createSupabaseAdminProfileRepository } from "./supabase-admin-profile-repository";

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateCurrentAdminProfile(formData: FormData): Promise<never> {
  const localeValue = read(formData, "locale");
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "en";
  const path = `/${locale}/admin/profile` as Route;
  try {
    const context = await requireReadyAdminContext(locale);
    const client = await createAdminServerClient();
    if (!client) throw new Error("ADMIN_PROFILE_UNAVAILABLE");
    await new AdminProfileService(createSupabaseAdminProfileRepository(client)).update({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      displayName: read(formData, "displayName"),
      expectedVersion: Number(read(formData, "expectedVersion")),
      reason: read(formData, "reason"),
      requestId: crypto.randomUUID(),
    });
  } catch {
    redirect(`${path}?error=update` as Route);
  }
  redirect(`${path}?status=updated` as Route);
}
