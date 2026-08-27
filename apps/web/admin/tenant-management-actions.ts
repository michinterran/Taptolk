"use server";

import {
  AdminAuthorizationError,
  TenantManagementError,
  TenantManagementService,
  type TenantStatus,
} from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseTenantManagementRepository,
  TenantManagementRepositoryError,
} from "./supabase-tenant-management-repository";

type TenantActionError = "conflict" | "forbidden" | "unavailable" | "validation";
type TenantActionStatus = "created" | "statusChanged" | "updated";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function readVersion(formData: FormData): number {
  return Number(readString(formData, "expectedVersion"));
}

function readStatus(formData: FormData, key: string): TenantStatus | null {
  const value = readString(formData, key);
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED" ? value : null;
}

function tenantCatalogPath(
  locale: AppLocale,
  kind: "error" | "status",
  value: TenantActionError | TenantActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/platform/tenants?${kind}=${value}`) as Route;
}

function mapActionError(error: unknown): TenantActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof TenantManagementError) {
    return "validation";
  }
  if (error instanceof TenantManagementRepositoryError) {
    return error.code === "CONFLICT"
      ? "conflict"
      : error.code === "FORBIDDEN"
        ? "forbidden"
        : "unavailable";
  }
  return "unavailable";
}

async function createTenantService(locale: AppLocale) {
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(tenantCatalogPath(locale, "error", "unavailable"));
  }
  const membership = context.decision.membership;
  return {
    actor: {
      authorization: {
        mfaVerified: context.mfaLevel === "aal2",
        role: membership.role,
        scope: { type: membership.scopeType },
      },
      userId: context.userId,
    },
    service: new TenantManagementService(createSupabaseTenantManagementRepository(client)),
  };
}

export async function createTenant(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createTenantService(locale);
    await service.create({
      actor,
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      slug: readString(formData, "slug"),
    });
  } catch (error) {
    redirect(tenantCatalogPath(locale, "error", mapActionError(error)));
  }
  redirect(tenantCatalogPath(locale, "status", "created"));
}

export async function updateTenant(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createTenantService(locale);
    await service.update({
      actor,
      expectedVersion: readVersion(formData),
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      slug: readString(formData, "slug"),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(tenantCatalogPath(locale, "error", mapActionError(error)));
  }
  redirect(tenantCatalogPath(locale, "status", "updated"));
}

export async function changeTenantStatus(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const currentStatus = readStatus(formData, "currentStatus");
  const nextStatus = readStatus(formData, "nextStatus");
  if (!currentStatus || !nextStatus) {
    redirect(tenantCatalogPath(locale, "error", "validation"));
  }
  try {
    const { actor, service } = await createTenantService(locale);
    await service.changeStatus({
      actor,
      currentStatus,
      expectedVersion: readVersion(formData),
      nextStatus,
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(tenantCatalogPath(locale, "error", mapActionError(error)));
  }
  redirect(tenantCatalogPath(locale, "status", "statusChanged"));
}
