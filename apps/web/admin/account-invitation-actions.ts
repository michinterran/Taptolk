"use server";

import {
  AdminAccountInvitationError,
  AdminAccountInvitationService,
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
import { getAdminAuthCallbackUrl } from "../auth/registration-routing";
import { createAdminServerClient } from "../auth/server-client";
import { createAdminServiceClient } from "../auth/service-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  AdminAccountInvitationRepositoryError,
  createSupabaseAdminAccountInvitationRepository,
} from "./supabase-admin-account-invitation-repository";

type InvitationActionError =
  | "conflict"
  | "configuration"
  | "expired"
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

function invitationPath(
  locale: AppLocale,
  kind: "error" | "status",
  value: InvitationActionError | "invited" | "accepted",
): Route {
  return getLocalizedAdminPath(locale, `/platform/access?${kind}=${value}`) as Route;
}

function accessPath(locale: AppLocale, error?: InvitationActionError): Route {
  return getLocalizedAdminPath(locale, error ? `/access?error=${error}` : "/access") as Route;
}

function mapActionError(error: unknown): InvitationActionError {
  if (error instanceof AdminAuthorizationError) {
    return error.code === "OUT_OF_SCOPE" || error.code === "ROLE_FORBIDDEN"
      ? "forbidden"
      : "unavailable";
  }
  if (error instanceof AdminAccountInvitationError) {
    return "validation";
  }
  if (error instanceof AdminAccountInvitationRepositoryError) {
    if (error.code === "EXPIRED") return "expired";
    if (error.code === "FORBIDDEN") return "forbidden";
    if (error.code === "CONFLICT") return "conflict";
    return "unavailable";
  }
  return "unavailable";
}

async function createInvitationService(locale: AppLocale) {
  const context = await requireReadyAdminContext(locale);
  const [sessionClient, serviceClient] = await Promise.all([
    createAdminServerClient(),
    Promise.resolve(createAdminServiceClient()),
  ]);
  if (!sessionClient || !serviceClient) {
    redirect(invitationPath(locale, "error", "configuration"));
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
    service: new AdminAccountInvitationService(
      createSupabaseAdminAccountInvitationRepository(sessionClient, serviceClient),
    ),
  };
}

export async function inviteAdminAccount(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const role = readRole(formData);
  const scopeType = readScopeType(formData);
  if (!role || !scopeType) {
    redirect(invitationPath(locale, "error", "validation"));
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
  const { actor, service } = await createInvitationService(locale);

  try {
    await service.invite({
      actor,
      displayName: readString(formData, "displayName"),
      email: readString(formData, "email"),
      reason: readString(formData, "reason"),
      redirectTo: getAdminAuthCallbackUrl(locale, "login"),
      requestId: crypto.randomUUID(),
      role,
      scope,
    });
  } catch (error) {
    redirect(invitationPath(locale, "error", mapActionError(error)));
  }

  redirect(invitationPath(locale, "status", "invited"));
}

export async function acceptAdminInvitation(formData: FormData): Promise<never> {
  const locale = readLocale(formData);
  const sessionClient = await createAdminServerClient();
  const serviceClient = createAdminServiceClient();
  if (!sessionClient || !serviceClient) {
    redirect(accessPath(locale, "configuration"));
  }

  const membershipId = readString(formData, "membershipId");
  const service = new AdminAccountInvitationService(
    createSupabaseAdminAccountInvitationRepository(sessionClient, serviceClient),
  );
  try {
    await service.accept({ membershipId });
  } catch (error) {
    redirect(accessPath(locale, mapActionError(error)));
  }

  redirect(getLocalizedAdminPath(locale));
}
