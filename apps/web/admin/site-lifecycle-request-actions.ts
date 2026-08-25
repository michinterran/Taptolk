"use server";

import {
  AdminAuthorizationError,
  SiteLifecycleRequestError,
  SiteLifecycleRequestService,
} from "@taptolk/application";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseSiteLifecycleRequestRepository,
  SiteLifecycleRequestRepositoryError,
} from "./supabase-site-lifecycle-request-repository";

export type LifecycleActionError =
  | "blocked"
  | "conflict"
  | "forbidden"
  | "unavailable"
  | "validation";
export type LifecycleActionStatus =
  | "requestApproved"
  | "requestCancelled"
  | "requestCreated"
  | "requestRejected";
export type LifecycleActionResult =
  | { error: LifecycleActionError; status: "error" }
  | { status: LifecycleActionStatus };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function mapError(error: unknown): LifecycleActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof SiteLifecycleRequestError) {
    return error.code === "SELF_REVIEW_FORBIDDEN" || error.code === "REQUESTER_REQUIRED"
      ? "forbidden"
      : "validation";
  }
  if (error instanceof SiteLifecycleRequestRepositoryError) {
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

async function context(locale: AppLocale) {
  const admin = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    return null;
  }
  return {
    actor: {
      authorization: toAdminAuthorizationContext(
        admin.decision.membership,
        admin.mfaLevel === "aal2",
      ),
      userId: admin.userId,
    },
    service: new SiteLifecycleRequestService(createSupabaseSiteLifecycleRequestRepository(client)),
  };
}

function reviewInput(formData: FormData) {
  return {
    action: readString(formData, "action"),
    auditRequestId: crypto.randomUUID(),
    expectedRequestVersion: Number(readString(formData, "expectedRequestVersion")),
    lifecycleRequestId: readString(formData, "lifecycleRequestId"),
    managementCompanyId: readString(formData, "managementCompanyId"),
    reason: readString(formData, "reason"),
    requestedBy: readString(formData, "requestedBy"),
    siteId: readString(formData, "siteId"),
    tenantId: readString(formData, "tenantId"),
  };
}

export async function requestSiteLifecycle(formData: FormData): Promise<LifecycleActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await context(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
    await service.request({
      action: readString(formData, "action"),
      actor,
      auditRequestId: crypto.randomUUID(),
      currentStatus: readString(formData, "currentStatus") as "ACTIVE" | "CLOSED" | "SUSPENDED",
      expectedSiteVersion: Number(readString(formData, "expectedSiteVersion")),
      managementCompanyId: readString(formData, "managementCompanyId"),
      reason: readString(formData, "reason"),
      siteId: readString(formData, "siteId"),
      tenantId: readString(formData, "tenantId"),
    });
  } catch (error) {
    return { error: mapError(error), status: "error" };
  }
  return { status: "requestCreated" };
}

export async function approveSiteLifecycleRequest(
  formData: FormData,
): Promise<LifecycleActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await context(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
    await service.approve({ actor, ...reviewInput(formData) });
  } catch (error) {
    return { error: mapError(error), status: "error" };
  }
  return { status: "requestApproved" };
}

export async function rejectSiteLifecycleRequest(
  formData: FormData,
): Promise<LifecycleActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await context(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
    await service.reject({ actor, ...reviewInput(formData) });
  } catch (error) {
    return { error: mapError(error), status: "error" };
  }
  return { status: "requestRejected" };
}

export async function cancelSiteLifecycleRequest(
  formData: FormData,
): Promise<LifecycleActionResult> {
  const locale = readLocale(formData);
  try {
    const serviceContext = await context(locale);
    if (!serviceContext) return { error: "unavailable", status: "error" };
    const { actor, service } = serviceContext;
    await service.cancel({ actor, ...reviewInput(formData) });
  } catch (error) {
    return { error: mapError(error), status: "error" };
  }
  return { status: "requestCancelled" };
}
