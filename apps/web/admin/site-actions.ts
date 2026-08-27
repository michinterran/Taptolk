"use server";

import {
  AdminAuthorizationError,
  type OrganizationStatus,
  SiteApplicationService,
  SiteManagementError,
} from "@taptolk/application";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseSiteManagementRepository,
  SiteRepositoryError,
} from "./supabase-site-management-repository";

export type SiteActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
export type SiteActionStatus =
  | "contractUpdated"
  | "created"
  | "operationalUpdated"
  | "statusChanged";
export type SiteActionResult =
  | { error: SiteActionError; status: "error" }
  | { status: SiteActionStatus };

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
          : error.code === "VALIDATION"
            ? "validation"
            : "unavailable";
  }
  return "unavailable";
}

async function createService(locale: AppLocale) {
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    return null;
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

export async function createSite(formData: FormData): Promise<SiteActionResult> {
  const locale = readLocale(formData);
  const parent = readParentScope(formData);
  try {
    const serviceContext = await createService(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
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
    return { error: mapError(error), status: "error" };
  }
  return { status: "created" };
}

export async function updateSiteOperational(formData: FormData): Promise<SiteActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await createService(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
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
    return { error: mapError(error), status: "error" };
  }
  return { status: "operationalUpdated" };
}

export async function updateSiteContract(formData: FormData): Promise<SiteActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await createService(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
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
    return { error: mapError(error), status: "error" };
  }
  return { status: "contractUpdated" };
}

export async function changeSiteStatus(formData: FormData): Promise<SiteActionResult> {
  const locale = readLocale(formData);
  const currentStatus = readStatus(formData, "currentStatus");
  const nextStatus = readStatus(formData, "nextStatus");
  if (!currentStatus || !nextStatus) {
    return { error: "validation", status: "error" };
  }
  try {
    const serviceContext = await createService(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
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
    return { error: mapError(error), status: "error" };
  }
  return { status: "statusChanged" };
}
