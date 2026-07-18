export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "PLATFORM_OPERATOR",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
  "SITE_OPERATOR",
  "READ_ONLY",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "tenant:create",
  "tenant:read",
  "management-company:create",
  "management-company:read",
  "site:create",
  "site:create-request",
  "site:create-approve",
  "site:read",
  "site:update-operational",
  "site:update-contract",
  "site:suspend-request",
  "site:suspend-approve",
  "site:archive-request",
  "site:archive-approve",
  "membership:manage",
  "membership:approve-account",
  "audit:read",
  "qr-batch:read",
  "qr-batch:request",
  "qr-batch:sample-approve",
  "qr-batch:generation-approve",
  "qr-batch:retry-request",
  "qr-batch:retry",
  "qr-asset:read",
  "qr-asset:assign",
  "qr-asset:revoke-request",
  "qr-asset:revoke-approve",
  "qr-asset:revoke",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

function permissions(...values: AdminPermission[]): ReadonlySet<AdminPermission> {
  return new Set<AdminPermission>(values);
}

const ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlySet<AdminPermission>>> = Object.freeze({
  MANAGEMENT_ADMIN: permissions(
    "tenant:read",
    "management-company:read",
    "site:create-request",
    "site:read",
    "site:update-operational",
    "site:suspend-request",
    "site:archive-request",
    "membership:manage",
    "audit:read",
    "qr-batch:read",
    "qr-batch:request",
    "qr-batch:sample-approve",
    "qr-batch:retry-request",
    "qr-asset:read",
    "qr-asset:assign",
    "qr-asset:revoke-request",
    "qr-asset:revoke-approve",
  ),
  PLATFORM_OPERATOR: permissions(
    "tenant:read",
    "management-company:read",
    "site:read",
    "site:update-operational",
    "site:suspend-approve",
    "site:archive-request",
    "membership:manage",
    "audit:read",
    "qr-batch:read",
    "qr-batch:request",
    "qr-batch:sample-approve",
    "qr-batch:retry",
    "qr-asset:read",
    "qr-asset:assign",
    "qr-asset:revoke-request",
  ),
  READ_ONLY: permissions(
    "tenant:read",
    "management-company:read",
    "site:read",
    "audit:read",
    "qr-batch:read",
    "qr-asset:read",
  ),
  SITE_ADMIN: permissions(
    "tenant:read",
    "management-company:read",
    "site:read",
    "site:update-operational",
    "site:suspend-request",
    "membership:manage",
    "audit:read",
    "qr-batch:read",
    "qr-batch:request",
    "qr-batch:sample-approve",
    "qr-batch:retry-request",
    "qr-asset:read",
    "qr-asset:assign",
    "qr-asset:revoke-request",
  ),
  SITE_OPERATOR: permissions(
    "tenant:read",
    "management-company:read",
    "site:read",
    "qr-batch:read",
    "qr-asset:read",
    "qr-asset:assign",
  ),
  SUPER_ADMIN: permissions(...ADMIN_PERMISSIONS),
});

const MFA_REQUIRED_ROLES: ReadonlySet<AdminRole> = new Set([
  "SUPER_ADMIN",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
]);

export function getRolePermissions(role: AdminRole): readonly AdminPermission[] {
  return ADMIN_PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission));
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}
