import "server-only";

import {
  type AdminAccessDecision,
  type AdminMembership,
  type AdminMembershipStatus,
  type AdminProfile,
  type AdminProfileStatus,
  resolveAdminAccess,
} from "@taptolk/auth";
import {
  ADMIN_ROLES,
  ADMIN_SCOPE_TYPES,
  type AdminRole,
  type AdminScopeType,
} from "@taptolk/domain";
import { createLogger } from "@taptolk/observability";
import { createAdminServerClient } from "./server-client";

const logger = createLogger({ service: "taptolk-web" });

interface AdminProfileRow {
  display_name: string;
  status: AdminProfileStatus;
  user_id: string;
}

interface AdminMembershipRow {
  id: string;
  management_company_id: string | null;
  role: AdminRole;
  scope_type: AdminScopeType;
  site_id: string | null;
  status: AdminMembershipStatus;
  tenant_id: string | null;
  user_id: string;
}

export type AdminContextLoadResult =
  | { status: "CONFIGURATION_MISSING" }
  | { status: "LOAD_ERROR" }
  | {
      decision: AdminAccessDecision;
      email: string | null;
      mfaLevel: "aal1" | "aal2" | null;
      status: "AVAILABLE";
      userId: string | null;
    };

interface AvailableAdminContext {
  decision: AdminAccessDecision;
  email: string | null;
  mfaLevel: "aal1" | "aal2" | null;
  userId: string;
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.some((role) => role === value);
}

function isAdminScopeType(value: unknown): value is AdminScopeType {
  return typeof value === "string" && ADMIN_SCOPE_TYPES.some((scopeType) => scopeType === value);
}

function isProfileStatus(value: unknown): value is AdminProfileStatus {
  return value === "INVITED" || value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

function isMembershipStatus(value: unknown): value is AdminMembershipStatus {
  return value === "INVITED" || value === "ACTIVE" || value === "SUSPENDED" || value === "REVOKED";
}

function normalizeMfaLevel(value: unknown): "aal1" | "aal2" | null {
  return value === "aal1" || value === "aal2" ? value : null;
}

function getErrorCode(error: unknown): string | number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { code?: unknown; status?: unknown };
  if (typeof candidate.code === "string") {
    return candidate.code;
  }
  if (typeof candidate.status === "number") {
    return candidate.status;
  }
  return null;
}

function mapProfile(row: unknown): AdminProfile | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Partial<AdminProfileRow>;
  if (
    typeof candidate.user_id !== "string" ||
    typeof candidate.display_name !== "string" ||
    !isProfileStatus(candidate.status)
  ) {
    return null;
  }

  return {
    displayName: candidate.display_name,
    status: candidate.status,
    userId: candidate.user_id,
  };
}

function mapMembership(row: unknown): AdminMembership | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Partial<AdminMembershipRow>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.user_id !== "string" ||
    !isAdminRole(candidate.role) ||
    !isAdminScopeType(candidate.scope_type) ||
    !isMembershipStatus(candidate.status)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    managementCompanyId: candidate.management_company_id ?? null,
    role: candidate.role,
    scopeType: candidate.scope_type,
    siteId: candidate.site_id ?? null,
    status: candidate.status,
    tenantId: candidate.tenant_id ?? null,
    userId: candidate.user_id,
  };
}

function availableAdminContext({
  decision,
  email,
  mfaLevel,
  userId,
}: AvailableAdminContext): AdminContextLoadResult {
  return {
    decision,
    email,
    mfaLevel,
    status: "AVAILABLE",
    userId,
  };
}

export async function loadAdminContext(): Promise<AdminContextLoadResult> {
  const client = await createAdminServerClient();
  if (!client) {
    return { status: "CONFIGURATION_MISSING" };
  }

  const claimsResult = await client.auth.getClaims();
  const claims = claimsResult.data?.claims;
  const subject = claims?.sub;
  if (claimsResult.error || typeof subject !== "string") {
    return {
      decision: { state: "UNAUTHENTICATED" },
      email: null,
      mfaLevel: null,
      status: "AVAILABLE",
      userId: null,
    };
  }
  const emailClaim = claims?.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;
  const mfaLevel = normalizeMfaLevel(claims?.aal);

  const profileResult = await client
    .from("admin_profiles")
    .select("user_id, display_name, status")
    .eq("user_id", subject)
    .maybeSingle();
  if (profileResult.error) {
    logger.error("admin.context.load_failed", {
      profileErrorCode: getErrorCode(profileResult.error),
      stage: "profile",
    });
    return { status: "LOAD_ERROR" };
  }

  const profile = mapProfile(profileResult.data);
  const profileDecision = resolveAdminAccess(
    {
      authenticated: true,
      hasVerifiedTotp: false,
      mfaLevel,
    },
    profile,
    [],
  );
  if (profileDecision.state === "ACCESS_DENIED" && profileDecision.reason === "PROFILE_INACTIVE") {
    return availableAdminContext({
      decision: profileDecision,
      email,
      mfaLevel,
      userId: subject,
    });
  }

  const membershipsResult = await client
    .from("admin_memberships")
    .select("id, user_id, tenant_id, management_company_id, site_id, role, scope_type, status")
    .eq("user_id", subject)
    .eq("status", "ACTIVE");
  if (membershipsResult.error) {
    logger.error("admin.context.load_failed", {
      membershipsErrorCode: getErrorCode(membershipsResult.error),
      stage: "memberships",
    });
    return { status: "LOAD_ERROR" };
  }

  const memberships = Array.isArray(membershipsResult.data)
    ? membershipsResult.data
        .map((membership) => mapMembership(membership))
        .filter((membership): membership is AdminMembership => membership !== null)
    : [];
  const decision = resolveAdminAccess(
    {
      authenticated: true,
      hasVerifiedTotp: false,
      mfaLevel,
    },
    profile,
    memberships,
  );
  return availableAdminContext({
    decision,
    email,
    mfaLevel,
    userId: subject,
  });
}
