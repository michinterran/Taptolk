"use server";

import { AdminAuthorizationError, BrandAssetError, BrandAssetService } from "@taptolk/application";
import { BrandAssetValidationError } from "@taptolk/qr-engine";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createAdminServiceClient } from "../auth/service-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  BrandAssetRepositoryError,
  createSupabaseBrandAssetRepository,
} from "./supabase-brand-asset-repository";

type ActionError = "conflict" | "forbidden" | "unavailable" | "validation";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function path(locale: AppLocale, kind: "error" | "status", value: string): Route {
  return getLocalizedAdminPath(locale, `/qr-inventory?${kind}=${value}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof BrandAssetError || error instanceof BrandAssetValidationError) {
    return "validation";
  }
  if (error instanceof BrandAssetRepositoryError) {
    return error.code === "CONFLICT"
      ? "conflict"
      : error.code === "FORBIDDEN"
        ? "forbidden"
        : "unavailable";
  }
  return "unavailable";
}

export async function uploadBrandAsset(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const [tenantId = "", managementCompanyId = "", siteId = ""] = readString(
      formData,
      "siteScope",
    ).split("|");
    const file = formData.get("brandAsset");
    if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) {
      throw new BrandAssetError("INVALID_NAME");
    }
    const admin = await requireReadyAdminContext(locale);
    const [userClient, serviceClient] = await Promise.all([
      createAdminServerClient(),
      Promise.resolve(createAdminServiceClient()),
    ]);
    if (!userClient || !serviceClient) {
      redirect(path(locale, "error", "unavailable"));
    }
    await new BrandAssetService(
      createSupabaseBrandAssetRepository(userClient, serviceClient),
    ).upload({
      actor: {
        authorization: toAdminAuthorizationContext(
          admin.decision.membership,
          admin.mfaLevel === "aal2",
        ),
        userId: admin.userId,
      },
      assetType: "SITE_LOGO",
      auditRequestId: crypto.randomUUID(),
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      managementCompanyId,
      mimeType: file.type,
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      siteId,
      tenantId,
    });
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", "brandAssetUploaded"));
}
