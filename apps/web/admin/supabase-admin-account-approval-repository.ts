import "server-only";

import type {
  AdminAccountApprovalRepository,
  AdminApprovalScopeCatalog,
  AdminIdentityProvider,
  AdminScopeOption,
  PendingAdminAccount,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;
type AuthAdminUser = Awaited<
  ReturnType<AdminServiceClient["auth"]["admin"]["listUsers"]>
>["data"]["users"][number];

interface ProfileStatusRow {
  status: "ACTIVE" | "CLOSED" | "INVITED" | "SUSPENDED";
  user_id: string;
}

interface ScopeRow {
  id: string;
  name: string;
  parent_id?: string | null;
  tenant_id?: string;
}

export class AdminAccountApprovalRepositoryError extends Error {
  readonly code: "CONFLICT" | "UNAVAILABLE";

  constructor(code: AdminAccountApprovalRepositoryError["code"]) {
    super(`Admin account approval repository failed: ${code}`);
    this.name = "AdminAccountApprovalRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });
const AUTH_PAGE_SIZE = 200;

function mapProvider(value: unknown): AdminIdentityProvider {
  if (value === "email" || value === "google") {
    return value;
  }
  return "other";
}

function readSuggestedDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim().slice(0, 100);
  }
  return (user.email?.split("@")[0] ?? "").slice(0, 100);
}

function mapScopeOption(
  row: ScopeRow,
  tenantId: string,
  parentId: string | null,
): AdminScopeOption {
  return {
    id: row.id,
    name: row.name,
    parentId,
    tenantId,
  };
}

function isConflictError(error: { message?: string }): boolean {
  return (
    error.message?.includes("ALREADY_DECIDED") === true ||
    error.message?.includes("ALREADY_EXISTS") === true
  );
}

export function createSupabaseAdminAccountApprovalRepository(
  sessionClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): AdminAccountApprovalRepository {
  return {
    async approve(input) {
      const result = await sessionClient.rpc("approve_admin_account", {
        p_display_name: input.displayName,
        p_management_company_id: input.scope.managementCompanyId ?? null,
        p_reason: input.reason,
        p_request_id: input.requestId,
        p_role: input.role,
        p_scope_type: input.scope.type,
        p_site_id: input.scope.siteId ?? null,
        p_target_user_id: input.targetUserId,
        p_tenant_id: input.scope.tenantId ?? null,
      });

      if (result.error || typeof result.data !== "string") {
        logger.error("admin.account_approval.command_failed", {
          errorCode: result.error?.code ?? null,
          operation: "approve",
        });
        throw new AdminAccountApprovalRepositoryError(
          result.error && isConflictError(result.error) ? "CONFLICT" : "UNAVAILABLE",
        );
      }

      return { membershipId: result.data };
    },

    async listPendingAccounts({ limit }) {
      const users: AuthAdminUser[] = [];
      let page = 1;
      let total = 0;

      while (users.length < limit) {
        const result = await serviceClient.auth.admin.listUsers({
          page,
          perPage: Math.min(AUTH_PAGE_SIZE, limit - users.length),
        });
        if (result.error) {
          logger.error("admin.account_approval.auth_directory_failed", {
            errorCode: result.error.code ?? null,
          });
          throw new AdminAccountApprovalRepositoryError("UNAVAILABLE");
        }

        users.push(...result.data.users);
        total = result.data.total;
        if (result.data.nextPage === null || result.data.users.length === 0) {
          break;
        }
        page = result.data.nextPage;
      }

      const userIds = users.map((user) => user.id);
      const profileResult =
        userIds.length === 0
          ? { data: [] as ProfileStatusRow[], error: null }
          : await sessionClient
              .from("admin_profiles")
              .select("user_id, status")
              .in("user_id", userIds);
      if (profileResult.error) {
        logger.error("admin.account_approval.profile_directory_failed", {
          errorCode: profileResult.error.code,
        });
        throw new AdminAccountApprovalRepositoryError("UNAVAILABLE");
      }

      const profileStatusByUser = new Map(
        (profileResult.data ?? []).map((profile) => [
          profile.user_id,
          (profile as ProfileStatusRow).status,
        ]),
      );
      const accounts = users
        .filter((user) => {
          const status = profileStatusByUser.get(user.id);
          return status === undefined || status === "INVITED";
        })
        .filter(
          (
            user,
          ): user is typeof user & {
            created_at: string;
            email: string;
          } => typeof user.email === "string" && typeof user.created_at === "string",
        )
        .map(
          (user): PendingAdminAccount => ({
            createdAt: user.created_at,
            email: user.email,
            emailVerified: typeof user.email_confirmed_at === "string",
            provider: mapProvider(user.app_metadata.provider),
            suggestedDisplayName: readSuggestedDisplayName(user),
            userId: user.id,
          }),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            left.userId.localeCompare(right.userId),
        );

      return {
        accounts,
        truncated: total > users.length,
      };
    },

    async listScopeCatalog(): Promise<AdminApprovalScopeCatalog> {
      const [tenantResult, companyResult, siteResult] = await Promise.all([
        sessionClient
          .from("tenants")
          .select("id, name")
          .is("deleted_at", null)
          .eq("status", "ACTIVE")
          .order("name", { ascending: true })
          .order("id", { ascending: true }),
        sessionClient
          .from("management_companies")
          .select("id, tenant_id, name")
          .is("deleted_at", null)
          .eq("status", "ACTIVE")
          .order("name", { ascending: true })
          .order("id", { ascending: true }),
        sessionClient
          .from("sites")
          .select("id, tenant_id, management_company_id, name")
          .is("deleted_at", null)
          .eq("status", "ACTIVE")
          .order("name", { ascending: true })
          .order("id", { ascending: true }),
      ]);
      const firstError = tenantResult.error ?? companyResult.error ?? siteResult.error;
      if (firstError) {
        logger.error("admin.account_approval.scope_catalog_failed", {
          errorCode: firstError.code,
        });
        throw new AdminAccountApprovalRepositoryError("UNAVAILABLE");
      }

      return {
        managementCompanies: (companyResult.data ?? []).map((company) =>
          mapScopeOption(company, company.tenant_id, company.tenant_id),
        ),
        sites: (siteResult.data ?? []).map((site) =>
          mapScopeOption(site, site.tenant_id, site.management_company_id),
        ),
        tenants: (tenantResult.data ?? []).map((tenant) => mapScopeOption(tenant, tenant.id, null)),
      };
    },

    async reject(input) {
      const result = await sessionClient.rpc("reject_admin_account", {
        p_display_name: input.displayName,
        p_reason: input.reason,
        p_request_id: input.requestId,
        p_target_user_id: input.targetUserId,
      });
      if (result.error) {
        logger.error("admin.account_approval.command_failed", {
          errorCode: result.error.code,
          operation: "reject",
        });
        throw new AdminAccountApprovalRepositoryError(
          isConflictError(result.error) ? "CONFLICT" : "UNAVAILABLE",
        );
      }
    },
  };
}
