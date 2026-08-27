import "server-only";

import {
  ADMIN_ROLES,
  ADMIN_SCOPE_TYPES,
  type AdminRole,
  type AdminScopeType,
} from "@taptolk/domain";
import { createAdminServerClient } from "./server-client";

export interface AdminInvitationContext {
  expiresAt: string | null;
  membershipId: string;
  role: AdminRole;
  scopeType: AdminScopeType;
}

function isRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.some((role) => role === value);
}

function isScopeType(value: unknown): value is AdminScopeType {
  return typeof value === "string" && ADMIN_SCOPE_TYPES.some((scope) => scope === value);
}

export async function loadAdminInvitationContext(): Promise<AdminInvitationContext | null> {
  const client = await createAdminServerClient();
  if (!client) return null;

  const userResult = await client.auth.getUser();
  const userId = userResult.data.user?.id;
  if (userResult.error || !userId) return null;

  const result = await client
    .from("admin_memberships")
    .select("id, role, scope_type, invitation_expires_at")
    .eq("user_id", userId)
    .eq("status", "INVITED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) return null;

  const row = result.data as {
    id?: unknown;
    invitation_expires_at?: unknown;
    role?: unknown;
    scope_type?: unknown;
  };
  if (
    typeof row.id !== "string" ||
    !isRole(row.role) ||
    !isScopeType(row.scope_type) ||
    (row.invitation_expires_at !== null && typeof row.invitation_expires_at !== "string")
  ) {
    return null;
  }

  return {
    expiresAt: row.invitation_expires_at,
    membershipId: row.id,
    role: row.role,
    scopeType: row.scope_type,
  };
}
