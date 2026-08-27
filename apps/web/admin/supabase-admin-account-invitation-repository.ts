import "server-only";

import type { AdminAccountInvitationRepository } from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

export class AdminAccountInvitationRepositoryError extends Error {
  readonly code: "CONFLICT" | "EXPIRED" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: AdminAccountInvitationRepositoryError["code"]) {
    super(`Admin account invitation repository failed: ${code}`);
    this.name = "AdminAccountInvitationRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function mapRpcError(error: {
  code?: string | undefined;
  message?: string | undefined;
}): "CONFLICT" | "EXPIRED" | "FORBIDDEN" | "UNAVAILABLE" {
  const message = error.message ?? "";
  if (message.includes("EXPIRED")) {
    return "EXPIRED";
  }
  if (message.includes("FORBIDDEN") || message.includes("ROLE_FORBIDDEN")) {
    return "FORBIDDEN";
  }
  if (
    message.includes("ALREADY") ||
    message.includes("ACCOUNT_NOT_FOUND") ||
    message.includes("MEMBERSHIP_ALREADY_EXISTS")
  ) {
    return "CONFLICT";
  }
  return "UNAVAILABLE";
}

function isAuthConflict(error: {
  code?: string | undefined;
  message?: string | undefined;
}): boolean {
  const message = error.message ?? "";
  return (
    error.code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered")
  );
}

export function createSupabaseAdminAccountInvitationRepository(
  sessionClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): AdminAccountInvitationRepository {
  return {
    async invite(input) {
      const authResult = await serviceClient.auth.admin.inviteUserByEmail(input.email, {
        ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
      });
      if (authResult.error || !authResult.data.user) {
        logger.error("admin.account_invitation.auth_invite_failed", {
          errorCode: authResult.error?.code ?? null,
        });
        throw new AdminAccountInvitationRepositoryError(
          authResult.error && isAuthConflict(authResult.error) ? "CONFLICT" : "UNAVAILABLE",
        );
      }

      const result = await sessionClient.rpc("create_admin_account_invitation", {
        p_display_name: input.displayName,
        p_management_company_id: input.scope.managementCompanyId ?? null,
        p_reason: input.reason,
        p_request_id: input.requestId,
        p_role: input.role,
        p_scope_type: input.scope.type,
        p_site_id: input.scope.siteId ?? null,
        p_target_user_id: authResult.data.user.id,
        p_tenant_id: input.scope.tenantId ?? null,
      });
      if (result.error || typeof result.data !== "string") {
        logger.error("admin.account_invitation.command_failed", {
          errorCode: result.error?.code ?? null,
          operation: "invite",
        });
        throw new AdminAccountInvitationRepositoryError(
          result.error ? mapRpcError(result.error) : "UNAVAILABLE",
        );
      }

      return { membershipId: result.data };
    },

    async accept(input) {
      const result = await sessionClient.rpc("accept_admin_account_invitation", {
        p_membership_id: input.membershipId,
      });
      if (result.error || typeof result.data !== "string") {
        logger.error("admin.account_invitation.command_failed", {
          errorCode: result.error?.code ?? null,
          operation: "accept",
        });
        throw new AdminAccountInvitationRepositoryError(
          result.error ? mapRpcError(result.error) : "UNAVAILABLE",
        );
      }
      return { membershipId: result.data };
    },
  };
}
