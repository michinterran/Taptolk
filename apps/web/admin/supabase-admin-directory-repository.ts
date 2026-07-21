import "server-only";

import type {
  AdminDirectoryItem,
  AdminDirectoryMembershipStatus,
  AdminDirectoryRepository,
} from "@taptolk/application";
import type { AdminRole, AdminScopeType } from "@taptolk/domain";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

const ROLES = new Set<AdminRole>([
  "SUPER_ADMIN",
  "PLATFORM_OPERATOR",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
  "SITE_OPERATOR",
  "READ_ONLY",
]);
const SCOPES = new Set<AdminScopeType>(["PLATFORM", "TENANT", "MANAGEMENT_COMPANY", "SITE"]);
const MEMBERSHIP_STATUSES = new Set<AdminDirectoryMembershipStatus>([
  "ACTIVE",
  "INVITED",
  "REVOKED",
  "SUSPENDED",
]);

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("ADMIN_DIRECTORY_UNAVAILABLE");
  return value;
}

function mapItem(value: unknown, emailByUser: ReadonlyMap<string, string>): AdminDirectoryItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ADMIN_DIRECTORY_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  const role = row.role as AdminRole;
  const scopeType = row.scope_type as AdminScopeType;
  const status = row.membership_status as AdminDirectoryMembershipStatus;
  if (
    typeof row.membership_id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.display_name !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.version !== "number" ||
    !ROLES.has(role) ||
    !SCOPES.has(scopeType) ||
    !MEMBERSHIP_STATUSES.has(status) ||
    !["ACTIVE", "CLOSED", "INVITED", "SUSPENDED"].includes(String(row.profile_status))
  ) {
    throw new Error("ADMIN_DIRECTORY_UNAVAILABLE");
  }
  const tenantId = nullableString(row, "tenant_id");
  const managementCompanyId = nullableString(row, "management_company_id");
  const siteId = nullableString(row, "site_id");
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    email: emailByUser.get(row.user_id) ?? null,
    managementCompanyName: nullableString(row, "management_company_name"),
    membershipId: row.membership_id,
    profileStatus: row.profile_status as AdminDirectoryItem["profileStatus"],
    role,
    scope: {
      type: scopeType,
      ...(tenantId ? { tenantId } : {}),
      ...(managementCompanyId ? { managementCompanyId } : {}),
      ...(siteId ? { siteId } : {}),
    },
    siteName: nullableString(row, "site_name"),
    status,
    tenantName: nullableString(row, "tenant_name"),
    userId: row.user_id,
    version: row.version,
  };
}

export function createSupabaseAdminDirectoryRepository(
  sessionClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): AdminDirectoryRepository {
  return {
    async list() {
      const [directory, users] = await Promise.all([
        sessionClient.rpc("read_admin_account_directory"),
        serviceClient.auth.admin.listUsers({ page: 1, perPage: 200 }),
      ]);
      if (directory.error || users.error || !Array.isArray(directory.data)) {
        throw new Error("ADMIN_DIRECTORY_UNAVAILABLE");
      }
      const emailByUser = new Map(
        users.data.users.flatMap((user) =>
          typeof user.email === "string" ? [[user.id, user.email] as const] : [],
        ),
      );
      return directory.data.map((item) => mapItem(item, emailByUser));
    },
    async update(input) {
      const result = await sessionClient.rpc("update_admin_membership_assignment", {
        p_expected_version: input.expectedVersion,
        p_management_company_id: input.scope.managementCompanyId ?? null,
        p_membership_id: input.membershipId,
        p_reason: input.reason,
        p_request_id: input.requestId,
        p_role: input.role,
        p_scope_type: input.scope.type,
        p_site_id: input.scope.siteId ?? null,
        p_status: input.status,
        p_tenant_id: input.scope.tenantId ?? null,
      });
      if (result.error) throw new Error("ADMIN_DIRECTORY_UPDATE_FAILED");
    },
  };
}
