import type { AdminMembership } from "@taptolk/auth";
import type { AdminAuthorizationContext } from "@taptolk/domain";

export function toAdminAuthorizationContext(
  membership: AdminMembership,
  mfaVerified: boolean,
): AdminAuthorizationContext {
  return {
    mfaVerified,
    role: membership.role,
    scope: {
      ...(membership.managementCompanyId
        ? { managementCompanyId: membership.managementCompanyId }
        : {}),
      ...(membership.siteId ? { siteId: membership.siteId } : {}),
      ...(membership.tenantId ? { tenantId: membership.tenantId } : {}),
      type: membership.scopeType,
    },
  };
}
