import {
  type AdminAuthorizationContext,
  type AdminMembershipScope,
  type AdminRole,
  authorizeAdminAction,
  isAdminRoleScopeValid,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type AdminDirectoryMembershipStatus = "ACTIVE" | "INVITED" | "REVOKED" | "SUSPENDED";
export type AdminDirectoryChangeAction =
  | "ADMIN_ACCOUNT_APPROVED"
  | "ADMIN_ACCOUNT_INVITATION_ACCEPTED"
  | "ADMIN_ACCOUNT_INVITED"
  | "ADMIN_ACCOUNT_REJECTED"
  | "ADMIN_MEMBERSHIP_ASSIGNMENT_UPDATED";

export interface AdminDirectoryActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface AdminDirectoryItem {
  createdAt: string;
  displayName: string;
  email: string | null;
  lastChangedAction: AdminDirectoryChangeAction | null;
  lastChangedAt: string | null;
  lastChangedByDisplayName: string | null;
  managementCompanyName: string | null;
  membershipId: string;
  profileStatus: "ACTIVE" | "CLOSED" | "INVITED" | "SUSPENDED";
  role: AdminRole;
  scope: AdminMembershipScope;
  siteName: string | null;
  status: AdminDirectoryMembershipStatus;
  tenantName: string | null;
  userId: string;
  version: number;
}

export interface AdminDirectoryRepository {
  list(): Promise<readonly AdminDirectoryItem[]>;
  update(input: {
    expectedVersion: number;
    membershipId: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    status: Exclude<AdminDirectoryMembershipStatus, "INVITED">;
  }): Promise<void>;
}

function resource(scope: AdminMembershipScope) {
  return {
    ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    tenantId: scope.tenantId ?? "platform-admin-directory",
  };
}

export class AdminDirectoryService {
  constructor(private readonly repository: AdminDirectoryRepository) {}

  async list(input: { actor: AdminDirectoryActor }): Promise<readonly AdminDirectoryItem[]> {
    assertAdminAuthorized(
      authorizeAdminAction(
        input.actor.authorization,
        "membership:manage",
        resource(input.actor.authorization.scope),
      ),
    );
    return this.repository.list();
  }

  async update(input: {
    actor: AdminDirectoryActor;
    expectedVersion: number;
    membershipId: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    status: Exclude<AdminDirectoryMembershipStatus, "INVITED">;
  }): Promise<void> {
    if (
      !UUID_PATTERN.test(input.actor.userId) ||
      !UUID_PATTERN.test(input.membershipId) ||
      !UUID_PATTERN.test(input.requestId) ||
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      !isAdminRoleScopeValid(input.role, input.scope) ||
      input.reason.trim().length < 3 ||
      input.reason.trim().length > 500
    ) {
      throw new Error("INVALID_ADMIN_DIRECTORY_UPDATE");
    }
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "membership:manage", resource(input.scope)),
    );
    await this.repository.update({
      expectedVersion: input.expectedVersion,
      membershipId: input.membershipId,
      reason: input.reason.trim(),
      requestId: input.requestId,
      role: input.role,
      scope: input.scope,
      status: input.status,
    });
  }
}
