export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "PLATFORM_OPERATOR",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
  "SITE_OPERATOR",
  "READ_ONLY",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_SCOPE_TYPES = ["PLATFORM", "TENANT", "MANAGEMENT_COMPANY", "SITE"] as const;

export type AdminScopeType = (typeof ADMIN_SCOPE_TYPES)[number];

export const ADMIN_PERMISSIONS = [
  "tenant:create",
  "tenant:read",
  "management-company:create",
  "management-company:read",
  "site:create",
  "site:read",
  "site:update",
  "site:archive",
  "membership:manage",
  "audit:read",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

function permissions(...values: AdminPermission[]): ReadonlySet<AdminPermission> {
  return new Set<AdminPermission>(values);
}

const ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlySet<AdminPermission>>> = Object.freeze({
  MANAGEMENT_ADMIN: permissions(
    "tenant:read",
    "management-company:read",
    "site:create",
    "site:read",
    "site:update",
    "membership:manage",
    "audit:read",
  ),
  PLATFORM_OPERATOR: permissions(
    "tenant:read",
    "management-company:read",
    "site:create",
    "site:read",
    "site:update",
    "membership:manage",
    "audit:read",
  ),
  READ_ONLY: permissions("tenant:read", "management-company:read", "site:read", "audit:read"),
  SITE_ADMIN: permissions(
    "tenant:read",
    "management-company:read",
    "site:read",
    "site:update",
    "membership:manage",
    "audit:read",
  ),
  SITE_OPERATOR: permissions("tenant:read", "management-company:read", "site:read"),
  SUPER_ADMIN: permissions(...ADMIN_PERMISSIONS),
});

const MFA_REQUIRED_ROLES: ReadonlySet<AdminRole> = new Set([
  "SUPER_ADMIN",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
]);

export interface AdminMembershipScope {
  managementCompanyId?: string;
  siteId?: string;
  tenantId?: string;
  type: AdminScopeType;
}

export interface ResourceScope {
  managementCompanyId?: string;
  siteId?: string;
  tenantId: string;
}

export interface AdminAuthorizationContext {
  mfaVerified: boolean;
  role: AdminRole;
  scope: AdminMembershipScope;
}

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: "MFA_REQUIRED" | "OUT_OF_SCOPE" | "ROLE_FORBIDDEN" };

export function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isResourceWithinScope(
  membership: AdminMembershipScope,
  resource: ResourceScope,
): boolean {
  if (membership.type === "PLATFORM") {
    return true;
  }

  if (!membership.tenantId || membership.tenantId !== resource.tenantId) {
    return false;
  }

  if (membership.type === "TENANT") {
    return true;
  }

  if (
    !membership.managementCompanyId ||
    membership.managementCompanyId !== resource.managementCompanyId
  ) {
    return false;
  }

  if (membership.type === "MANAGEMENT_COMPANY") {
    return true;
  }

  return Boolean(membership.siteId && membership.siteId === resource.siteId);
}

export function authorizeAdminAction(
  context: AdminAuthorizationContext,
  permission: AdminPermission,
  resource: ResourceScope,
): AuthorizationDecision {
  if (!roleHasPermission(context.role, permission)) {
    return { allowed: false, reason: "ROLE_FORBIDDEN" };
  }

  if (roleRequiresMfa(context.role) && !context.mfaVerified) {
    return { allowed: false, reason: "MFA_REQUIRED" };
  }

  if (!isResourceWithinScope(context.scope, resource)) {
    return { allowed: false, reason: "OUT_OF_SCOPE" };
  }

  return { allowed: true };
}
