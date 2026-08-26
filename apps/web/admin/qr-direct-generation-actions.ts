"use server";

import {
  AdminAuthorizationError,
  QrDirectGenerationError,
  type QrDirectGenerationResult,
  QrDirectGenerationService,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { enqueueQrGenerationPipelineWake } from "../internal/qr-generation-pipeline-wake";
import {
  createSupabaseQrDirectGenerationRepository,
  QrDirectGenerationRepositoryError,
} from "./supabase-qr-direct-generation-repository";

type ActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";

const logger = createLogger({ service: "taptolk-web" });

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
  value: ActionError | "batchRequested",
  params: Readonly<Record<string, string>> = {},
) {
  const search = new URLSearchParams({ [kind]: value });
  for (const [key, paramValue] of Object.entries(params)) {
    if (paramValue.trim().length > 0) search.set(key, paramValue);
  }
  return getLocalizedAdminPath(locale, `/qr-inventory?${search.toString()}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) return "forbidden";
  if (error instanceof QrDirectGenerationError) {
    if (error.code === "APPROVAL_REQUIRED") return "blocked";
    // A missing or stale site version is a concurrency conflict. The page can
    // recover by reloading the site snapshot while preserving the scope.
    return error.code === "INVALID_VERSION" ? "conflict" : "validation";
  }
  if (error instanceof QrDirectGenerationRepositoryError) {
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

export async function requestAdminDirectQrGeneration(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(path(locale, "error", "unavailable"));
  }
  const context = await requireReadyAdminContext(locale);
  const service = new QrDirectGenerationService(createSupabaseQrDirectGenerationRepository(client));
  const siteId = readString(formData, "siteId");
  const quantity = readString(formData, "quantity");
  const companyId = readString(formData, "companyId");
  const idempotencyKey = readString(formData, "idempotencyKey");
  let result: QrDirectGenerationResult;
  try {
    result = await service.request({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      expectedSiteVersion: Number(readString(formData, "expectedSiteVersion")),
      idempotencyKey,
      quantity: Number(quantity),
      reason: readString(formData, "reason"),
      siteId,
    });
  } catch (error) {
    logger.warn("admin.qr_direct_generation.rejected", {
      errorCode:
        error instanceof QrDirectGenerationError
          ? `QR_DIRECT_${error.code}`
          : error instanceof AdminAuthorizationError
            ? "ADMIN_AUTHORIZATION"
            : error instanceof QrDirectGenerationRepositoryError
              ? `QR_DIRECT_REPOSITORY_${error.code}`
              : "QR_DIRECT_UNKNOWN",
    });
    redirect(
      path(locale, "error", mapError(error), {
        company: companyId,
        confirmed: companyId && siteId ? "1" : "",
        quantity,
        site: siteId,
      }),
    );
  }
  await Promise.all(
    result.batches.map((batch) =>
      enqueueQrGenerationPipelineWake({
        batchId: batch.batchId,
        requestId: result.requestId,
      }),
    ),
  );
  redirect(
    path(locale, "status", "batchRequested", {
      batches: result.batches.map((batch) => batch.batchId).join(","),
      company: companyId,
      confirmed: "1",
      quantity,
      request: result.requestId,
      site: siteId,
    }),
  );
}
