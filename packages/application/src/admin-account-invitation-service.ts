import {
  type AdminAuthorizationContext,
  type AdminMembershipScope,
  type AdminRole,
  authorizeAdminAction,
  isAdminRoleScopeValid,
} from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export interface AdminAccountInvitationRepository {
  invite(input: {
    displayName: string;
    email: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    redirectTo: string | null;
  }): Promise<{ membershipId: string }>;
  accept(input: { membershipId: string }): Promise<{ membershipId: string }>;
}

export class AdminAccountInvitationError extends Error {
  readonly code:
    | "INVALID_DISPLAY_NAME"
    | "INVALID_EMAIL"
    | "INVALID_MEMBERSHIP_ID"
    | "INVALID_REASON"
    | "INVALID_REQUEST_ID"
    | "INVALID_SCOPE";

  constructor(code: AdminAccountInvitationError["code"]) {
    super(`Admin account invitation rejected: ${code}`);
    this.name = "AdminAccountInvitationError";
    this.code = code;
  }
}

interface InvitationActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function authorizeInvitationActor(actor: InvitationActor): void {
  if (!isUuid(actor.userId)) {
    throw new AdminAccountInvitationError("INVALID_MEMBERSHIP_ID");
  }
  if (actor.authorization.scope.type !== "PLATFORM") {
    throw new AdminAuthorizationError("OUT_OF_SCOPE");
  }
  assertAdminAuthorized(
    authorizeAdminAction(actor.authorization, "membership:approve-account", {
      tenantId: "platform-admin-accounts",
    }),
  );
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new AdminAccountInvitationError("INVALID_EMAIL");
  }
  return email;
}

function normalizeDisplayName(value: string): string {
  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 100) {
    throw new AdminAccountInvitationError("INVALID_DISPLAY_NAME");
  }
  return displayName;
}

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new AdminAccountInvitationError("INVALID_REASON");
  }
  return reason;
}

export class AdminAccountInvitationService {
  constructor(private readonly repository: AdminAccountInvitationRepository) {}

  async invite(input: {
    actor: InvitationActor;
    displayName: string;
    email: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    redirectTo: string | null;
  }): Promise<{ membershipId: string }> {
    authorizeInvitationActor(input.actor);
    if (!isUuid(input.requestId)) {
      throw new AdminAccountInvitationError("INVALID_REQUEST_ID");
    }
    if (!isAdminRoleScopeValid(input.role, input.scope)) {
      throw new AdminAccountInvitationError("INVALID_SCOPE");
    }

    return this.repository.invite({
      displayName: normalizeDisplayName(input.displayName),
      email: normalizeEmail(input.email),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      redirectTo: input.redirectTo,
      role: input.role,
      scope: input.scope,
    });
  }

  async accept(input: { membershipId: string }): Promise<{ membershipId: string }> {
    if (!isUuid(input.membershipId)) {
      throw new AdminAccountInvitationError("INVALID_MEMBERSHIP_ID");
    }
    return this.repository.accept({ membershipId: input.membershipId });
  }
}
