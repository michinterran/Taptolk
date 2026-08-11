"use server";

import {
  AdminAuthorizationError,
  ManagementCompanyManagementError,
  ManagementCompanyManagementService,
  type OrganizationStatus,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { protectManagementCompanyPhone } from "./management-company-contact-protector";
import {
  createSupabaseManagementCompanyManagementRepository,
  ManagementCompanyRepositoryError,
} from "./supabase-management-company-management-repository";

type CompanyActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type CompanyActionStatus = "created" | "statusChanged" | "updated";

export type ManagementCompanyCreateField =
  | "address"
  | "businessNumber"
  | "contactChannel"
  | "contactEmail"
  | "contactName"
  | "contactPhone"
  | "name"
  | "operationsManagerChannel"
  | "operationsManagerEmail"
  | "operationsManagerName"
  | "operationsManagerPhone"
  | "reason"
  | "representativePhone";

export type ManagementCompanyCreateFieldError =
  | "channelRequired"
  | "invalid"
  | "operationsManagerChannelRequired"
  | "required";

export interface ManagementCompanyCreateActionState {
  fieldErrors: Partial<
    Readonly<Record<ManagementCompanyCreateField, ManagementCompanyCreateFieldError>>
  >;
  formError?: Exclude<CompanyActionError, "validation">;
}

class ManagementCompanyPhoneInputError extends Error {
  constructor(readonly field: "contactPhone" | "operationsManagerPhone" | "representativePhone") {
    super("Management company phone input is invalid");
    this.name = "ManagementCompanyPhoneInputError";
  }
}

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

function companyPath(locale: AppLocale, companyId: string): Route {
  return getLocalizedAdminPath(locale, `/platform/management-companies/${companyId}`) as Route;
}

function safeReturnPath(formData: FormData, locale: AppLocale): Route {
  const fallback = getLocalizedAdminPath(locale, "/platform/management-companies") as Route;
  const value = readString(formData, "returnTo");
  const detailPrefix = `/${locale}/admin/platform/management-companies/`;
  if (
    value === `/${locale}/admin/platform/management-companies` ||
    value.startsWith(detailPrefix)
  ) {
    return value as Route;
  }
  return fallback;
}

function appendActionState(
  path: Route,
  kind: "error" | "status",
  value: CompanyActionError | CompanyActionStatus,
): Route {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${value}` as Route;
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
  if (
    error instanceof Error &&
    (error.message === "MANAGEMENT_COMPANY_CONTACT_PHONE_INVALID" ||
      error.message === "MANAGEMENT_COMPANY_CONTACT_PROTECTION_CONFIG_INVALID")
  ) {
    return error.message === "MANAGEMENT_COMPANY_CONTACT_PHONE_INVALID"
      ? "validation"
      : "unavailable";
  }
  return "unavailable";
}

function readProtectedPhone(formData: FormData, key: string): string {
  const value = readString(formData, key);
  if (!value.trim()) {
    return "";
  }
  const environment = parseServerEnvironment();
  if (!environment.APP_ENCRYPTION_KEY_V1) {
    throw new Error("MANAGEMENT_COMPANY_CONTACT_PROTECTION_CONFIG_INVALID");
  }
  try {
    return protectManagementCompanyPhone(value, {
      encryptionSecret: environment.APP_ENCRYPTION_KEY_V1,
      keyVersion: environment.APP_ENCRYPTION_KEY_VERSION,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MANAGEMENT_COMPANY_CONTACT_PHONE_INVALID" &&
      (key === "contactPhone" || key === "operationsManagerPhone" || key === "representativePhone")
    ) {
      throw new ManagementCompanyPhoneInputError(key);
    }
    throw error;
  }
}

function fieldError(
  field: ManagementCompanyCreateField,
  error: ManagementCompanyCreateFieldError,
): ManagementCompanyCreateActionState {
  return { fieldErrors: { [field]: error } };
}

function requiredOrInvalid(formData: FormData, key: string): ManagementCompanyCreateFieldError {
  return readString(formData, key).trim() ? "invalid" : "required";
}

function mapCreateError(error: unknown, formData: FormData): ManagementCompanyCreateActionState {
  if (error instanceof ManagementCompanyPhoneInputError) {
    return fieldError(error.field, "invalid");
  }
  if (error instanceof ManagementCompanyManagementError) {
    switch (error.code) {
      case "INVALID_ADDRESS":
        return fieldError("address", requiredOrInvalid(formData, "address"));
      case "INVALID_BUSINESS_NUMBER":
        return fieldError("businessNumber", requiredOrInvalid(formData, "businessNumber"));
      case "INVALID_CONTACT_CHANNEL":
        return fieldError("contactChannel", "channelRequired");
      case "INVALID_CONTACT_EMAIL":
        return fieldError("contactEmail", "invalid");
      case "INVALID_CONTACT_NAME":
        return fieldError("contactName", requiredOrInvalid(formData, "contactName"));
      case "INVALID_NAME":
        return fieldError("name", requiredOrInvalid(formData, "name"));
      case "INVALID_OPERATIONS_MANAGER_CHANNEL":
        return fieldError("operationsManagerChannel", "operationsManagerChannelRequired");
      case "INVALID_OPERATIONS_MANAGER_EMAIL":
        return fieldError("operationsManagerEmail", "invalid");
      case "INVALID_OPERATIONS_MANAGER_NAME":
        return fieldError(
          "operationsManagerName",
          requiredOrInvalid(formData, "operationsManagerName"),
        );
      case "INVALID_REASON":
        return fieldError("reason", requiredOrInvalid(formData, "reason"));
      default:
        return { fieldErrors: {}, formError: "unavailable" };
    }
  }
  const mappedError = mapError(error);
  return {
    fieldErrors: {},
    formError: mappedError === "validation" ? "unavailable" : mappedError,
  };
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

export async function createManagementCompany(
  _previousState: ManagementCompanyCreateActionState,
  formData: FormData,
): Promise<ManagementCompanyCreateActionState> {
  const locale = readLocale(formData);
  let companyId = "";
  try {
    const { actor, service } = await createService(locale);
    const result = await service.create({
      address: readString(formData, "address"),
      actor,
      businessNumber: readString(formData, "businessNumber"),
      contactEmail: readString(formData, "contactEmail"),
      contactName: readString(formData, "contactName"),
      contactPhoneEncrypted: readProtectedPhone(formData, "contactPhone"),
      name: readString(formData, "name"),
      operationsManagerEmail: readString(formData, "operationsManagerEmail"),
      operationsManagerName: readString(formData, "operationsManagerName"),
      operationsManagerPhoneEncrypted: readProtectedPhone(formData, "operationsManagerPhone"),
      representativePhoneEncrypted: readProtectedPhone(formData, "representativePhone"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
    });
    companyId = result.id;
  } catch (error) {
    return mapCreateError(error, formData);
  }
  redirect(appendActionState(companyPath(locale, companyId), "status", "created"));
}

export async function updateManagementCompany(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const returnTo = safeReturnPath(formData, locale);
  try {
    const { actor, service } = await createService(locale);
    await service.update({
      address: readString(formData, "address"),
      actor,
      businessNumber: readString(formData, "businessNumber"),
      companyId: readString(formData, "companyId"),
      contactEmail: readString(formData, "contactEmail"),
      contactName: readString(formData, "contactName"),
      contactPhoneEncrypted: readProtectedPhone(formData, "contactPhone"),
      expectedVersion: Number(readString(formData, "expectedVersion")),
      name: readString(formData, "name"),
      operationsManagerEmail: readString(formData, "operationsManagerEmail"),
      operationsManagerName: readString(formData, "operationsManagerName"),
      operationsManagerPhoneEncrypted: readProtectedPhone(formData, "operationsManagerPhone"),
      representativePhoneEncrypted: readProtectedPhone(formData, "representativePhone"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    redirect(appendActionState(returnTo, "error", mapError(error)));
  }
  redirect(appendActionState(returnTo, "status", "updated"));
}

export async function changeManagementCompanyStatus(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const returnTo = safeReturnPath(formData, locale);
  const currentStatus = readStatus(formData, "currentStatus");
  const nextStatus = readStatus(formData, "nextStatus");
  if (!currentStatus || !nextStatus) {
    redirect(appendActionState(returnTo, "error", "validation"));
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
    redirect(appendActionState(returnTo, "error", mapError(error)));
  }
  redirect(appendActionState(returnTo, "status", "statusChanged"));
}
