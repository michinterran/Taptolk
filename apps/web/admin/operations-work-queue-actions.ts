"use server";

import {
  type OperationsWorkItemKind,
  type OperationsWorkQueueMutation,
  OperationsWorkQueueService,
} from "@taptolk/application";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { isAppLocale } from "../i18n/locale";
import { createSupabaseOperationsWorkQueueRepository } from "./supabase-operations-work-queue-repository";

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readKind(value: string): OperationsWorkItemKind | null {
  return [
    "CONTACT_REQUEST",
    "UNANSWERED_CONTACT",
    "NOTIFICATION_FAILURE",
    "ESCALATION",
    "REPORT_REVIEW",
  ].includes(value)
    ? (value as OperationsWorkItemKind)
    : null;
}

function readType(value: string): OperationsWorkQueueMutation["type"] | null {
  return ["ACKNOWLEDGE", "ASSIGN", "START", "RESOLVE", "RETRY"].includes(value)
    ? (value as OperationsWorkQueueMutation["type"])
    : null;
}

function safeReturnPath(locale: string, value: string): Route {
  const fallback = `/${locale}/admin/operations`;
  return value.startsWith(fallback) && !value.startsWith("//")
    ? (value as Route)
    : (fallback as Route);
}

export async function mutateOperationsWorkQueue(formData: FormData): Promise<never> {
  const localeValue = read(formData, "locale");
  const locale = isAppLocale(localeValue) ? localeValue : "en";
  const returnPath = safeReturnPath(locale, read(formData, "returnPath"));
  const type = readType(read(formData, "type"));
  const kind = readKind(read(formData, "kind"));
  try {
    const context = await requireReadyAdminContext(locale);
    const client = await createAdminServerClient();
    if (!client || !type || !kind) throw new Error("OPERATIONS_WORK_QUEUE_UNAVAILABLE");
    await new OperationsWorkQueueService(
      createSupabaseOperationsWorkQueueRepository(client),
    ).mutate({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      mutation: {
        ...(type === "ASSIGN" && read(formData, "assigneeMembershipId")
          ? { assigneeMembershipId: read(formData, "assigneeMembershipId") }
          : {}),
        expectedVersion: Number(read(formData, "expectedVersion")),
        itemId: read(formData, "itemId"),
        kind,
        reason: read(formData, "reason"),
        requestId: crypto.randomUUID(),
        type,
      } as OperationsWorkQueueMutation,
      scope: {
        ...(read(formData, "managementCompanyId")
          ? { managementCompanyId: read(formData, "managementCompanyId") }
          : {}),
        ...(read(formData, "siteId") ? { siteId: read(formData, "siteId") } : {}),
      },
    });
  } catch {
    redirect(`${returnPath}?queueError=mutation` as Route);
  }
  redirect(`${returnPath}?queueStatus=updated` as Route);
}
