"use server";

import {
  AdminAuthorizationError,
  SiteLifecycleRequestError,
  SiteLifecycleRequestService,
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
  createSupabaseSiteLifecycleRequestRepository,
  SiteLifecycleRequestRepositoryError,
} from "./supabase-site-lifecycle-request-repository";

type LifecycleActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type LifecycleActionStatus =
  | "requestApproved"
  | "requestCancelled"
  | "requestCreated"
  | "requestRejected";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function path(
  locale: AppLocale,
  kind: "error" | "status",
  value: LifecycleActionError | LifecycleActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/sites?${kind}=${value}`) as Route;
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
    redirect(path(locale, "error", "unavailable"));
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

export async function requestSiteLifecycle(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await context(locale);
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
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", "requestCreated"));
}

export async function approveSiteLifecycleRequest(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await context(locale);
    await service.approve({ actor, ...reviewInput(formData) });
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", "requestApproved"));
}

export async function rejectSiteLifecycleRequest(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await context(locale);
    await service.reject({ actor, ...reviewInput(formData) });
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", "requestRejected"));
}

export async function cancelSiteLifecycleRequest(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  try {
    const { actor, service } = await context(locale);
    await service.cancel({ actor, ...reviewInput(formData) });
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", "requestCancelled"));
}
