"use server";

import {
  AdminAuthorizationError,
  ManagementCompanyManagementError,
  ManagementCompanyManagementService,
  type OrganizationStatus,
} from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseManagementCompanyManagementRepository,
  ManagementCompanyRepositoryError,
} from "./supabase-management-company-management-repository";

type CompanyActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type CompanyActionStatus = "created" | "statusChanged" | "updated";

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

function catalogPath(
  locale: AppLocale,
  kind: "error" | "status",
  value: CompanyActionError | CompanyActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/platform/management-companies?${kind}=${value}`) as Route;
}

function mapError(error: unknown): CompanyActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof ManagementCompanyManagementError) {
    return "validation";
  }
  if (error instanceof ManagementCompanyRepositoryError) {
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
    redirect(catalogPath(locale, "error", "unavailable"));
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
    service: new ManagementCompanyManagementService(
      createSupabaseManagementCompanyManagementRepository(client),
    ),
  };
}

export async function createManagementCompany(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createService(locale);
    await service.create({
      actor,
      businessNumber: readString(formData, "businessNumber"),
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(catalogPath(locale, "error", mapError(error)));
  }
  redirect(catalogPath(locale, "status", "created"));
}

export async function updateManagementCompany(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await createService(locale);
    await service.update({
      actor,
      businessNumber: readString(formData, "businessNumber"),
      companyId: readString(formData, "companyId"),
      expectedVersion: Number(readString(formData, "expectedVersion")),
      name: readString(formData, "name"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(catalogPath(locale, "error", mapError(error)));
  }
  redirect(catalogPath(locale, "status", "updated"));
}

export async function changeManagementCompanyStatus(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const currentStatus = readStatus(formData, "currentStatus");
  const nextStatus = readStatus(formData, "nextStatus");
  if (!currentStatus || !nextStatus) {
    redirect(catalogPath(locale, "error", "validation"));
  }
  try {
    const { actor, service } = await createService(locale);
    await service.changeStatus({
      actor,
      companyId: readString(formData, "companyId"),
      currentStatus,
      expectedVersion: Number(readString(formData, "expectedVersion")),
      nextStatus,
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(catalogPath(locale, "error", mapError(error)));
  }
  redirect(catalogPath(locale, "status", "statusChanged"));
}
