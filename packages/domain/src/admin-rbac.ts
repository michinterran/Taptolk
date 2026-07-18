import {
  type AdminPermission,
  type AdminRole,
  roleHasPermission,
  roleRequiresMfa,
} from "./admin-permission-catalog.js";

export const ADMIN_SCOPE_TYPES = ["PLATFORM", "TENANT", "MANAGEMENT_COMPANY", "SITE"] as const;

export type AdminScopeType = (typeof ADMIN_SCOPE_TYPES)[number];

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

export function isAdminRoleScopeValid(role: AdminRole, scope: AdminMembershipScope): boolean {
  if (role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR") {
    return (
      scope.type === "PLATFORM" && !scope.tenantId && !scope.managementCompanyId && !scope.siteId
    );
  }

  if (role === "MANAGEMENT_ADMIN") {
    return (
      scope.type === "MANAGEMENT_COMPANY" &&
      Boolean(scope.tenantId && scope.managementCompanyId) &&
      !scope.siteId
    );
  }

  if (role === "SITE_ADMIN" || role === "SITE_OPERATOR") {
    return (
      scope.type === "SITE" && Boolean(scope.tenantId && scope.managementCompanyId && scope.siteId)
    );
  }

  if (scope.type === "TENANT") {
    return Boolean(scope.tenantId && !scope.managementCompanyId && !scope.siteId);
  }
  if (scope.type === "MANAGEMENT_COMPANY") {
    return Boolean(scope.tenantId && scope.managementCompanyId && !scope.siteId);
  }
  if (scope.type === "SITE") {
    return Boolean(scope.tenantId && scope.managementCompanyId && scope.siteId);
  }
  return false;
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
