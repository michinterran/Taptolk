export {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  type AdminPermission,
  type AdminRole,
  getRolePermissions,
  roleHasPermission,
  roleRequiresMfa,
} from "./admin-permission-catalog.js";
export {
  ADMIN_SCOPE_TYPES,
  type AdminAuthorizationContext,
  type AdminMembershipScope,
  type AdminScopeType,
  type AuthorizationDecision,
  authorizeAdminAction,
  isAdminRoleScopeValid,
  isResourceWithinScope,
  type ResourceScope,
} from "./admin-rbac.js";
