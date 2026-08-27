import type { AdminRole, AdminScopeType } from "@taptolk/domain";
import { isAdminRoleScopeValid } from "@taptolk/domain";

export type AdminProfileStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "CLOSED";
export type AdminMembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface AdminProfile {
  displayName: string;
  status: AdminProfileStatus;
  userId: string;
}

export interface AdminMembership {
  id: string;
  managementCompanyId: string | null;
  role: AdminRole;
  scopeType: AdminScopeType;
  siteId: string | null;
  status: AdminMembershipStatus;
  tenantId: string | null;
  userId: string;
}

export interface AdminAuthenticationState {
  authenticated: boolean;
  hasVerifiedTotp: boolean;
  mfaLevel: "aal1" | "aal2" | null;
}

export type AdminAccessDecision =
  | { state: "UNAUTHENTICATED" }
  | {
      profile: AdminProfile | null;
      reason: "PROFILE_INACTIVE" | "MEMBERSHIP_INACTIVE";
      state: "ACCESS_DENIED";
    }
  | {
      membership: AdminMembership;
      profile: AdminProfile;
      state: "READY";
    };

const ROLE_SELECTION_PRIORITY: Readonly<Record<AdminRole, number>> = Object.freeze({
  SUPER_ADMIN: 0,
  PLATFORM_OPERATOR: 1,
  MANAGEMENT_ADMIN: 2,
  SITE_ADMIN: 3,
  SITE_OPERATOR: 4,
  READ_ONLY: 5,
});

export function selectPrimaryAdminMembership(
  memberships: readonly AdminMembership[],
): AdminMembership | null {
  return (
    [...memberships]
      .filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          isAdminRoleScopeValid(membership.role, {
            ...(membership.managementCompanyId
              ? { managementCompanyId: membership.managementCompanyId }
              : {}),
            ...(membership.siteId ? { siteId: membership.siteId } : {}),
            ...(membership.tenantId ? { tenantId: membership.tenantId } : {}),
            type: membership.scopeType,
          }),
      )
      .sort(
        (left, right) =>
          ROLE_SELECTION_PRIORITY[left.role] - ROLE_SELECTION_PRIORITY[right.role] ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

export function resolveAdminAccess(
  authentication: AdminAuthenticationState,
  profile: AdminProfile | null,
  memberships: readonly AdminMembership[],
): AdminAccessDecision {
  if (!authentication.authenticated) {
    return { state: "UNAUTHENTICATED" };
  }

  if (profile?.status !== "ACTIVE") {
    return {
      profile,
      reason: "PROFILE_INACTIVE",
      state: "ACCESS_DENIED",
    };
  }

  const membership = selectPrimaryAdminMembership(memberships);
  if (!membership) {
    return {
      profile,
      reason: "MEMBERSHIP_INACTIVE",
      state: "ACCESS_DENIED",
    };
  }

  return { membership, profile, state: "READY" };
}

export function getAdminLandingArea(role: AdminRole): "platform" | "tenant" {
  return role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR" ? "platform" : "tenant";
}
