import {
  type AdminAuthorizationContext,
  type AdminMembershipScope,
  type AdminRole,
  authorizeAdminAction,
  isAdminRoleScopeValid,
} from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export const ADMIN_ACCOUNT_SCAN_LIMIT = 1_000;
export const ADMIN_APPROVAL_PAGE_SIZE = 20;
export type AdminApprovalSort = "newest" | "oldest";

export type AdminIdentityProvider = "email" | "google" | "other";

export interface PendingAdminAccount {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  provider: AdminIdentityProvider;
  suggestedDisplayName: string;
  userId: string;
}

export interface AdminScopeOption {
  id: string;
  name: string;
  parentId: string | null;
  tenantId: string;
}

export interface AdminApprovalScopeCatalog {
  managementCompanies: readonly AdminScopeOption[];
  sites: readonly AdminScopeOption[];
  tenants: readonly AdminScopeOption[];
}

export interface AdminApprovalQueue {
  accounts: readonly PendingAdminAccount[];
  page: number;
  pageSize: number;
  total: number;
  truncated: boolean;
}

export interface AdminAccountApprovalRepository {
  approve(input: {
    displayName: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    targetUserId: string;
  }): Promise<{ membershipId: string }>;
  findUserIdByEmail(email: string): Promise<string | null>;
  listPendingAccounts(input: {
    limit: number;
  }): Promise<{ accounts: readonly PendingAdminAccount[]; truncated: boolean }>;
  listScopeCatalog(): Promise<AdminApprovalScopeCatalog>;
  reject(input: {
    displayName: string;
    reason: string;
    requestId: string;
    targetUserId: string;
  }): Promise<void>;
}

export class AdminAccountApprovalError extends Error {
  readonly code:
    | "ACCOUNT_NOT_FOUND"
    | "INVALID_DISPLAY_NAME"
    | "INVALID_EMAIL"
    | "INVALID_REASON"
    | "INVALID_SCOPE"
    | "INVALID_USER_ID"
    | "SELF_ACTION_FORBIDDEN";

  constructor(code: AdminAccountApprovalError["code"]) {
    super(`Admin account approval rejected: ${code}`);
    this.name = "AdminAccountApprovalError";
    this.code = code;
  }
}

interface ApprovalActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

function normalizePage(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : 1;
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase().slice(0, 120) ?? "";
}

function normalizeSort(value: AdminApprovalSort | undefined): AdminApprovalSort {
  return value === "oldest" ? "oldest" : "newest";
}

function compareAccounts(a: PendingAdminAccount, b: PendingAdminAccount, sort: AdminApprovalSort) {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);
  const timeOrder = (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
  if (timeOrder !== 0) {
    return sort === "newest" ? -timeOrder : timeOrder;
  }
  return a.userId.localeCompare(b.userId);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function authorizeApprovalActor(actor: ApprovalActor): void {
  if (actor.authorization.scope.type !== "PLATFORM") {
    throw new AdminAuthorizationError("OUT_OF_SCOPE");
  }
  assertAdminAuthorized(
    authorizeAdminAction(actor.authorization, "membership:approve-account", {
      tenantId: "platform-admin-accounts",
    }),
  );
  if (!isUuid(actor.userId)) {
    throw new AdminAccountApprovalError("INVALID_USER_ID");
  }
}

function normalizeDisplayName(value: string): string {
  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 100) {
    throw new AdminAccountApprovalError("INVALID_DISPLAY_NAME");
  }
  return displayName;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new AdminAccountApprovalError("INVALID_EMAIL");
  }
  return email;
}

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new AdminAccountApprovalError("INVALID_REASON");
  }
  return reason;
}

function assertTarget(actorUserId: string, targetUserId: string): void {
  if (!isUuid(targetUserId)) {
    throw new AdminAccountApprovalError("INVALID_USER_ID");
  }
  if (actorUserId === targetUserId) {
    throw new AdminAccountApprovalError("SELF_ACTION_FORBIDDEN");
  }
}

export class AdminAccountApprovalService {
  constructor(private readonly repository: AdminAccountApprovalRepository) {}

  async list(input: {
    actor: ApprovalActor;
    page?: number;
    search?: string;
    sort?: AdminApprovalSort;
  }): Promise<{
    queue: AdminApprovalQueue;
    scopes: AdminApprovalScopeCatalog;
  }> {
    authorizeApprovalActor(input.actor);
    const page = normalizePage(input.page);
    const search = normalizeSearch(input.search);
    const sort = normalizeSort(input.sort);
    const [pending, scopes] = await Promise.all([
      this.repository.listPendingAccounts({ limit: ADMIN_ACCOUNT_SCAN_LIMIT }),
      this.repository.listScopeCatalog(),
    ]);
    const accounts = pending.accounts
      .filter((account) => {
        if (!search) {
          return true;
        }
        return `${account.suggestedDisplayName} ${account.email}`
          .toLocaleLowerCase()
          .includes(search);
      })
      .sort((a, b) => compareAccounts(a, b, sort));
    const offset = (page - 1) * ADMIN_APPROVAL_PAGE_SIZE;

    return {
      queue: {
        accounts: accounts.slice(offset, offset + ADMIN_APPROVAL_PAGE_SIZE),
        page,
        pageSize: ADMIN_APPROVAL_PAGE_SIZE,
        total: accounts.length,
        truncated: pending.truncated,
      },
      scopes,
    };
  }

  async approve(input: {
    actor: ApprovalActor;
    displayName: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
    targetUserId: string;
  }): Promise<{ membershipId: string }> {
    authorizeApprovalActor(input.actor);
    assertTarget(input.actor.userId, input.targetUserId);
    if (!isUuid(input.requestId)) {
      throw new AdminAccountApprovalError("INVALID_USER_ID");
    }
    if (!isAdminRoleScopeValid(input.role, input.scope)) {
      throw new AdminAccountApprovalError("INVALID_SCOPE");
    }

    return this.repository.approve({
      displayName: normalizeDisplayName(input.displayName),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      role: input.role,
      scope: input.scope,
      targetUserId: input.targetUserId,
    });
  }

  async assignExisting(input: {
    actor: ApprovalActor;
    displayName: string;
    email: string;
    reason: string;
    requestId: string;
    role: AdminRole;
    scope: AdminMembershipScope;
  }): Promise<{ membershipId: string }> {
    authorizeApprovalActor(input.actor);
    if (!isUuid(input.requestId)) {
      throw new AdminAccountApprovalError("INVALID_USER_ID");
    }
    if (!isAdminRoleScopeValid(input.role, input.scope)) {
      throw new AdminAccountApprovalError("INVALID_SCOPE");
    }

    const targetUserId = await this.repository.findUserIdByEmail(normalizeEmail(input.email));
    if (!targetUserId) {
      throw new AdminAccountApprovalError("ACCOUNT_NOT_FOUND");
    }

    return this.approve({
      actor: input.actor,
      displayName: input.displayName,
      reason: input.reason,
      requestId: input.requestId,
      role: input.role,
      scope: input.scope,
      targetUserId,
    });
  }

  async reject(input: {
    actor: ApprovalActor;
    displayName: string;
    reason: string;
    requestId: string;
    targetUserId: string;
  }): Promise<void> {
    authorizeApprovalActor(input.actor);
    assertTarget(input.actor.userId, input.targetUserId);
    if (!isUuid(input.requestId)) {
      throw new AdminAccountApprovalError("INVALID_USER_ID");
    }

    await this.repository.reject({
      displayName: normalizeDisplayName(input.displayName),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      targetUserId: input.targetUserId,
    });
  }
}
