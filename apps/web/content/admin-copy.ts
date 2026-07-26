import type { AdminRole, AdminScopeType } from "@taptolk/domain";
import type { MessageDictionary, MessageKey } from "./messages";

const ROLE_MESSAGE_KEYS: Readonly<Record<AdminRole, MessageKey>> = Object.freeze({
  MANAGEMENT_ADMIN: "admin.role.managementAdmin",
  PLATFORM_OPERATOR: "admin.role.platformOperator",
  READ_ONLY: "admin.role.readOnly",
  SITE_ADMIN: "admin.role.siteAdmin",
  SITE_OPERATOR: "admin.role.siteOperator",
  SUPER_ADMIN: "admin.role.superAdmin",
});

const SCOPE_MESSAGE_KEYS: Readonly<Record<AdminScopeType, MessageKey>> = Object.freeze({
  MANAGEMENT_COMPANY: "admin.scope.managementCompany",
  PLATFORM: "admin.scope.platform",
  SITE: "admin.scope.site",
  TENANT: "admin.scope.tenant",
});

export function getAdminRoleLabel(copy: MessageDictionary, role: AdminRole): string {
  return copy[ROLE_MESSAGE_KEYS[role]];
}

export function getAdminScopeLabel(copy: MessageDictionary, scopeType: AdminScopeType): string {
  return copy[SCOPE_MESSAGE_KEYS[scopeType]];
}
