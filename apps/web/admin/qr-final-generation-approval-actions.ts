"use server";

import {
  AdminAuthorizationError,
  QrFinalGenerationApprovalError,
  QrFinalGenerationApprovalService,
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
  createSupabaseQrFinalGenerationApprovalRepository,
  QrFinalGenerationApprovalRepositoryError,
} from "./supabase-qr-final-generation-approval-repository";

type ActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type ActionStatus = "finalApprovalCancelled" | "finalApprovalRequested" | "finalGenerationApproved";

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
  value: ActionError | ActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/qr-inventory?${kind}=${value}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof QrFinalGenerationApprovalError) {
    if (
      error.code === "INACTIVE_PARENT" ||
      error.code === "INVALID_DESIGN_STATUS" ||
      error.code === "INVALID_SAMPLE_STATUS"
    ) {
      return "blocked";
    }
    if (
      error.code === "BATCH_NOT_FOUND" ||
      error.code === "REQUESTER_REQUIRED" ||
      error.code === "SELF_APPROVAL_FORBIDDEN"
    ) {
      return "forbidden";
    }
    return error.code === "GENERATION_JOB_EXISTS" ||
      error.code === "INVALID_BATCH_STATUS" ||
      error.code === "VERSION_CONFLICT"
      ? "conflict"
      : "validation";
  }
  if (error instanceof QrFinalGenerationApprovalRepositoryError) {
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

async function commandContext(locale: AppLocale) {
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
    service: new QrFinalGenerationApprovalService(
      createSupabaseQrFinalGenerationApprovalRepository(client),
    ),
  };
}

function commandInput(formData: FormData) {
  return {
    batchId: readString(formData, "batchId"),
    expectedBatchVersion: Number(readString(formData, "expectedBatchVersion")),
    reason: readString(formData, "reason"),
    requestId: readString(formData, "requestId"),
  };
}

async function run(
  formData: FormData,
  status: ActionStatus,
  command: (
    context: Awaited<ReturnType<typeof commandContext>>,
    locale: AppLocale,
  ) => Promise<unknown>,
): Promise<never> {
  const locale = readLocale(formData);
  try {
    await command(await commandContext(locale), locale);
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", status));
}

export async function requestQrBatchFinalApproval(formData: FormData): Promise<never> {
  return run(formData, "finalApprovalRequested", async ({ actor, service }) => {
    await service.requestFinalApproval({
      actor,
      ...commandInput(formData),
    });
  });
}

export async function approveQrBatchFinalGeneration(formData: FormData): Promise<never> {
  return run(formData, "finalGenerationApproved", async ({ actor, service }) => {
    await service.approveFinalGeneration({
      actor,
      ...commandInput(formData),
    });
  });
}

export async function cancelQrBatchBeforeGenerationApproval(formData: FormData): Promise<never> {
  return run(formData, "finalApprovalCancelled", async ({ actor, service }) => {
    await service.cancelBeforeGenerationApproval({
      actor,
      ...commandInput(formData),
    });
  });
}
