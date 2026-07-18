"use server";

import {
  AdminAccountApprovalError,
  AdminAccountApprovalService,
  AdminAuthorizationError,
} from "@taptolk/application";
import {
  ADMIN_ROLES,
  ADMIN_SCOPE_TYPES,
  type AdminMembershipScope,
  type AdminRole,
  type AdminScopeType,
} from "@taptolk/domain";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createAdminServiceClient } from "../auth/service-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  AdminAccountApprovalRepositoryError,
  createSupabaseAdminAccountApprovalRepository,
} from "./supabase-admin-account-approval-repository";

type ApprovalActionError =
  | "conflict"
  | "configuration"
  | "forbidden"
  | "unavailable"
  | "validation";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readOptionalString(formData: FormData, key: string): string | undefined {
  const value = readString(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function readRole(formData: FormData): AdminRole | null {
  const value = readString(formData, "role");
  return ADMIN_ROLES.find((role) => role === value) ?? null;
}

function readScopeType(formData: FormData): AdminScopeType | null {
  const value = readString(formData, "scopeType");
  return ADMIN_SCOPE_TYPES.find((scopeType) => scopeType === value) ?? null;
}

function approvalCenterPath(
  locale: AppLocale,
  kind: "error" | "status",
  value: ApprovalActionError | "approved" | "rejected",
): Route {
  return getLocalizedAdminPath(locale, `/platform/access?${kind}=${value}`) as Route;
}

function mapActionError(error: unknown): ApprovalActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof AdminAccountApprovalError) {
    return "validation";
  }
  if (error instanceof AdminAccountApprovalRepositoryError) {
    return error.code === "CONFLICT" ? "conflict" : "unavailable";
  }
  return "unavailable";
}

async function createApprovalService(locale: AppLocale) {
  const context = await requireReadyAdminContext(locale);
  const [sessionClient, serviceClient] = await Promise.all([
    createAdminServerClient(),
    Promise.resolve(createAdminServiceClient()),
  ]);
  if (!sessionClient || !serviceClient) {
    redirect(approvalCenterPath(locale, "error", "configuration"));
  }

  const membership = context.decision.membership;
  return {
    actor: {
      authorization: {
        mfaVerified: context.mfaLevel === "aal2",
        role: membership.role,
        scope: {
          ...(membership.managementCompanyId
            ? { managementCompanyId: membership.managementCompanyId }
            : {}),
          ...(membership.siteId ? { siteId: membership.siteId } : {}),
          ...(membership.tenantId ? { tenantId: membership.tenantId } : {}),
          type: membership.scopeType,
        },
      },
      userId: context.userId,
    },
    service: new AdminAccountApprovalService(
      createSupabaseAdminAccountApprovalRepository(sessionClient, serviceClient),
    ),
  };
}

export async function approvePendingAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const role = readRole(formData);
  const scopeType = readScopeType(formData);
  if (!role || !scopeType) {
    redirect(approvalCenterPath(locale, "error", "validation"));
  }

  const managementCompanyId = readOptionalString(formData, "managementCompanyId");
  const siteId = readOptionalString(formData, "siteId");
  const tenantId = readOptionalString(formData, "tenantId");
  const scope: AdminMembershipScope = {
    ...(managementCompanyId ? { managementCompanyId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(tenantId ? { tenantId } : {}),
    type: scopeType,
  };
  const { actor, service } = await createApprovalService(locale);

  try {
    await service.approve({
      actor,
      displayName: readString(formData, "displayName"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      role,
      scope,
      targetUserId: readString(formData, "targetUserId"),
    });
  } catch (error) {
    redirect(approvalCenterPath(locale, "error", mapActionError(error)));
  }

  redirect(approvalCenterPath(locale, "status", "approved"));
}

export async function rejectPendingAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const { actor, service } = await createApprovalService(locale);

  try {
    await service.reject({
      actor,
      displayName: readString(formData, "displayName"),
      reason: readString(formData, "reason"),
      requestId: crypto.randomUUID(),
      targetUserId: readString(formData, "targetUserId"),
    });
  } catch (error) {
    redirect(approvalCenterPath(locale, "error", mapActionError(error)));
  }

  redirect(approvalCenterPath(locale, "status", "rejected"));
}
