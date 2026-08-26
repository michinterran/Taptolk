"use server";

import {
  AdminAuthorizationError,
  QrOnlyGenerationError,
  QrOnlyGenerationService,
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
  createSupabaseQrOnlyGenerationRepository,
  QrOnlyGenerationRepositoryError,
} from "./supabase-qr-only-generation-repository";

type ActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function destination(
  locale: AppLocale,
  kind: "error" | "status",
  value: ActionError,
  formData: FormData,
): Route {
  const search = new URLSearchParams({ [kind]: value });
  for (const key of ["companyId", "siteId", "quantity"]) {
    const valueFromForm = readString(formData, key);
    if (valueFromForm) search.set(key === "companyId" ? "company" : key, valueFromForm);
  }
  return getLocalizedAdminPath(locale, `/qr-inventory/approval?${search.toString()}`) as Route;
}

function operationsDestination(
  locale: AppLocale,
  requestId: string,
  batchIds: readonly string[],
  formData: FormData,
): Route {
  const search = new URLSearchParams({
    status: "qrOnlyApprovalRequested",
    request: requestId,
    batches: batchIds.join(","),
  });
  for (const key of ["companyId", "siteId", "quantity"]) {
    const value = readString(formData, key);
    if (value) search.set(key === "companyId" ? "company" : key, value);
  }
  return getLocalizedAdminPath(locale, `/qr-inventory/operations?${search.toString()}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) return "forbidden";
  if (error instanceof QrOnlyGenerationError) return "validation";
  if (error instanceof QrOnlyGenerationRepositoryError) {
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

export async function requestQrOnlyGeneration(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const client = await createAdminServerClient();
  if (!client) redirect(destination(locale, "error", "unavailable", formData));
  const context = await requireReadyAdminContext(locale);
  let result: Awaited<ReturnType<QrOnlyGenerationService["request"]>>;
  try {
    result = await new QrOnlyGenerationService(
      createSupabaseQrOnlyGenerationRepository(client),
    ).request({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      expectedSiteVersion: Number(readString(formData, "expectedSiteVersion")),
      idempotencyKey: readString(formData, "idempotencyKey"),
      quantity: Number(readString(formData, "quantity")),
      reason: readString(formData, "reason"),
      siteId: readString(formData, "siteId"),
    });
  } catch (error) {
    redirect(destination(locale, "error", mapError(error), formData));
  }
  redirect(
    operationsDestination(
      locale,
      result.requestId,
      result.batches.map((batch) => batch.batchId),
      formData,
    ),
  );
}
