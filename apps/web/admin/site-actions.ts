"use server";

import {
  AdminAuthorizationError,
  type OrganizationStatus,
  SiteApplicationService,
  SiteManagementError,
} from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseSiteManagementRepository,
  SiteRepositoryError,
} from "./supabase-site-management-repository";

type SiteActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type SiteActionStatus = "contractUpdated" | "created" | "operationalUpdated" | "statusChanged";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function readStatus(formData: FormData, key: string): OrganizationStatus | null {
  const value = readString(formData, key);
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED" ? value : null;
}

function readParentScope(formData: FormData): {
  managementCompanyId: string;
  tenantId: string;
} {
  const [tenantId = "", managementCompanyId = ""] = readString(formData, "parentScope").split("|");
  return { managementCompanyId, tenantId };
}

function siteCatalogPath(
  locale: AppLocale,
  kind: "error" | "status",
  value: SiteActionError | SiteActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/sites?${kind}=${value}`) as Route;
}

function mapError(error: unknown): SiteActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof SiteManagementError) {
    return "validation";
  }
  if (error instanceof SiteRepositoryError) {
    return error.code === "BLOCKED"
      ? "blocked"
      : error.code === "CONFLICT"
        ? "conflict"
        : error.code === "FORBIDDEN"
          ? "forbidden"
          : "unavailable";
  }
  return "unavailable";
}

async function createService(locale: AppLocale) {
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(siteCatalogPath(locale, "error", "unavailable"));
  }
  const membership = context.decision.membership;
  return {
    actor: {
      authorization: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
      userId: context.userId,
    },
    service: new SiteApplicationService(createSupabaseSiteManagementRepository(client)),
  };
}

export async function createSite(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const parent = readParentScope(formData);
  try {
    const { actor, service } = await createService(locale);
    await service.create({
      actor,
      address: readString(formData, "address"),
      contractVehicleLimit: Number(readString(formData, "contractVehicleLimit")),
      managementCompanyId: parent.managementCompanyId,
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: parent.tenantId,
      timezone: readString(formData, "timezone"),
      type: readString(formData, "siteType"),
    });
  } catch (error) {
    redirect(siteCatalogPath(locale, "error", mapError(error)));
  }
  redirect(siteCatalogPath(locale, "status", "created"));
}

export async function updateSiteOperational(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createService(locale);
    await service.updateOperational({
      actor,
      address: readString(formData, "address"),
      expectedVersion: Number(readString(formData, "expectedVersion")),
      managementCompanyId: readString(formData, "managementCompanyId"),
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      siteId: readString(formData, "siteId"),
      tenantId: readString(formData, "tenantId"),
      timezone: readString(formData, "timezone"),
      type: readString(formData, "siteType"),
    });
  } catch (error) {
    redirect(siteCatalogPath(locale, "error", mapError(error)));
  }
  redirect(siteCatalogPath(locale, "status", "operationalUpdated"));
}

export async function updateSiteContract(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createService(locale);
    await service.updateContract({
      actor,
      contractVehicleLimit: Number(readString(formData, "contractVehicleLimit")),
      expectedVersion: Number(readString(formData, "expectedVersion")),
      managementCompanyId: readString(formData, "managementCompanyId"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      siteId: readString(formData, "siteId"),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(siteCatalogPath(locale, "error", mapError(error)));
  }
  redirect(siteCatalogPath(locale, "status", "contractUpdated"));
}

export async function changeSiteStatus(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const currentStatus = readStatus(formData, "currentStatus");
  const nextStatus = readStatus(formData, "nextStatus");
  if (!currentStatus || !nextStatus) {
    redirect(siteCatalogPath(locale, "error", "validation"));
  }
  try {
    const { actor, service } = await createService(locale);
    await service.changeStatus({
      actor,
      currentStatus,
      expectedVersion: Number(readString(formData, "expectedVersion")),
      managementCompanyId: readString(formData, "managementCompanyId"),
      nextStatus,
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      siteId: readString(formData, "siteId"),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(siteCatalogPath(locale, "error", mapError(error)));
  }
  redirect(siteCatalogPath(locale, "status", "statusChanged"));
}
