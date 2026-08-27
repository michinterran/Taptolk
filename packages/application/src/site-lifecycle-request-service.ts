import {
  type AdminAuthorizationContext,
  type AdminPermission,
  authorizeAdminAction,
  roleHasPermission,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";

export const SITE_LIFECYCLE_ACTIONS = ["SUSPEND", "REACTIVATE", "CLOSE"] as const;
export type SiteLifecycleAction = (typeof SITE_LIFECYCLE_ACTIONS)[number];

export const SITE_LIFECYCLE_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type SiteLifecycleRequestStatus = (typeof SITE_LIFECYCLE_REQUEST_STATUSES)[number];

export interface SiteLifecycleActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface SiteLifecycleRequestItem {
  action: SiteLifecycleAction;
  createdAt: string;
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  reason: string;
  requestedBy: string;
  requestedSiteVersion: number;
  siteId: string;
  siteName: string;
  status: SiteLifecycleRequestStatus;
  tenantId: string;
  tenantName: string;
  version: number;
}

export interface SiteLifecycleRequestReadModel {
  approvalQueue: readonly SiteLifecycleRequestItem[];
  cancellableRequestIds: ReadonlySet<string>;
  pendingBySiteId: ReadonlyMap<string, SiteLifecycleRequestItem>;
}

export interface SiteLifecycleCommandResult {
  requestId: string;
  requestVersion: number;
  siteId: string;
  siteVersion: number | null;
}

export interface SiteLifecycleRequestRepository {
  approve(input: {
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    reason: string;
  }): Promise<SiteLifecycleCommandResult>;
  cancel(input: {
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    reason: string;
  }): Promise<SiteLifecycleCommandResult>;
  listPending(): Promise<readonly SiteLifecycleRequestItem[]>;
  reject(input: {
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    reason: string;
  }): Promise<SiteLifecycleCommandResult>;
  request(input: {
    action: SiteLifecycleAction;
    auditRequestId: string;
    expectedSiteVersion: number;
    reason: string;
    siteId: string;
  }): Promise<SiteLifecycleCommandResult>;
}

export class SiteLifecycleRequestError extends Error {
  readonly code:
    | "INVALID_ACTION"
    | "INVALID_REASON"
    | "INVALID_REQUEST_ID"
    | "INVALID_SITE_ID"
    | "INVALID_STATUS_TRANSITION"
    | "INVALID_USER_ID"
    | "INVALID_VERSION"
    | "SELF_REVIEW_FORBIDDEN"
    | "REQUESTER_REQUIRED";

  constructor(code: SiteLifecycleRequestError["code"]) {
    super(`Site lifecycle request rejected: ${code}`);
    this.name = "SiteLifecycleRequestError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(
  value: string,
  code: "INVALID_REQUEST_ID" | "INVALID_SITE_ID" | "INVALID_USER_ID",
): void {
  if (!UUID_PATTERN.test(value)) {
    throw new SiteLifecycleRequestError(code);
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new SiteLifecycleRequestError("INVALID_VERSION");
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new SiteLifecycleRequestError("INVALID_REASON");
  }
  return normalized;
}

function assertAction(value: string): asserts value is SiteLifecycleAction {
  if (!SITE_LIFECYCLE_ACTIONS.some((action) => action === value)) {
    throw new SiteLifecycleRequestError("INVALID_ACTION");
  }
}

function requestPermission(action: SiteLifecycleAction): AdminPermission {
  return action === "CLOSE" ? "site:archive-request" : "site:suspend-request";
}

function reviewPermission(action: SiteLifecycleAction): AdminPermission {
  return action === "CLOSE" ? "site:archive-approve" : "site:suspend-approve";
}

function resource(input: { managementCompanyId: string; siteId: string; tenantId: string }) {
  return {
    managementCompanyId: input.managementCompanyId,
    siteId: input.siteId,
    tenantId: input.tenantId,
  };
}

function authorize(
  actor: SiteLifecycleActor,
  permission: AdminPermission,
  target: { managementCompanyId: string; siteId: string; tenantId: string },
): void {
  assertUuid(actor.userId, "INVALID_USER_ID");
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, resource(target)));
}

function isValidActionForStatus(
  action: SiteLifecycleAction,
  currentStatus: OrganizationStatus,
): boolean {
  if (action === "SUSPEND") {
    return currentStatus === "ACTIVE";
  }
  if (action === "REACTIVATE") {
    return currentStatus === "SUSPENDED";
  }
  return currentStatus === "ACTIVE" || currentStatus === "SUSPENDED";
}

function assertRequestIdentity(input: {
  auditRequestId: string;
  expectedRequestVersion: number;
  lifecycleRequestId: string;
}): void {
  assertUuid(input.auditRequestId, "INVALID_REQUEST_ID");
  assertUuid(input.lifecycleRequestId, "INVALID_REQUEST_ID");
  assertVersion(input.expectedRequestVersion);
}

export class SiteLifecycleRequestService {
  constructor(private readonly repository: SiteLifecycleRequestRepository) {}

  async list(input: { actor: SiteLifecycleActor }): Promise<SiteLifecycleRequestReadModel> {
    assertUuid(input.actor.userId, "INVALID_USER_ID");
    const actorScope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "site:read", {
        ...(actorScope.managementCompanyId
          ? { managementCompanyId: actorScope.managementCompanyId }
          : {}),
        ...(actorScope.siteId ? { siteId: actorScope.siteId } : {}),
        tenantId: actorScope.tenantId ?? "platform-site-lifecycle-requests",
      }),
    );
    const participatesInLifecycleReview = [
      "site:suspend-request",
      "site:archive-request",
      "site:suspend-approve",
      "site:archive-approve",
    ].some((permission) =>
      roleHasPermission(input.actor.authorization.role, permission as AdminPermission),
    );
    if (!participatesInLifecycleReview) {
      return {
        approvalQueue: [],
        cancellableRequestIds: new Set(),
        pendingBySiteId: new Map(),
      };
    }
    const requests = await this.repository.listPending();
    const approvalQueue = requests.filter((request) => {
      if (request.requestedBy === input.actor.userId) {
        return false;
      }
      return authorizeAdminAction(
        input.actor.authorization,
        reviewPermission(request.action),
        resource(request),
      ).allowed;
    });
    return {
      approvalQueue,
      cancellableRequestIds: new Set(
        requests
          .filter((request) => request.requestedBy === input.actor.userId)
          .map((request) => request.id),
      ),
      pendingBySiteId: new Map(requests.map((request) => [request.siteId, request])),
    };
  }

  async request(input: {
    action: string;
    actor: SiteLifecycleActor;
    auditRequestId: string;
    currentStatus: OrganizationStatus;
    expectedSiteVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteLifecycleCommandResult> {
    assertAction(input.action);
    authorize(input.actor, requestPermission(input.action), input);
    assertUuid(input.auditRequestId, "INVALID_REQUEST_ID");
    assertUuid(input.siteId, "INVALID_SITE_ID");
    assertVersion(input.expectedSiteVersion);
    if (!isValidActionForStatus(input.action, input.currentStatus)) {
      throw new SiteLifecycleRequestError("INVALID_STATUS_TRANSITION");
    }
    return this.repository.request({
      action: input.action,
      auditRequestId: input.auditRequestId,
      expectedSiteVersion: input.expectedSiteVersion,
      reason: normalizeReason(input.reason),
      siteId: input.siteId,
    });
  }

  async approve(input: {
    action: string;
    actor: SiteLifecycleActor;
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    managementCompanyId: string;
    reason: string;
    requestedBy: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteLifecycleCommandResult> {
    assertAction(input.action);
    authorize(input.actor, reviewPermission(input.action), input);
    assertRequestIdentity(input);
    assertUuid(input.requestedBy, "INVALID_USER_ID");
    if (input.actor.userId === input.requestedBy) {
      throw new SiteLifecycleRequestError("SELF_REVIEW_FORBIDDEN");
    }
    return this.repository.approve({
      auditRequestId: input.auditRequestId,
      expectedRequestVersion: input.expectedRequestVersion,
      lifecycleRequestId: input.lifecycleRequestId,
      reason: normalizeReason(input.reason),
    });
  }

  async reject(input: {
    action: string;
    actor: SiteLifecycleActor;
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    managementCompanyId: string;
    reason: string;
    requestedBy: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteLifecycleCommandResult> {
    assertAction(input.action);
    authorize(input.actor, reviewPermission(input.action), input);
    assertRequestIdentity(input);
    assertUuid(input.requestedBy, "INVALID_USER_ID");
    if (input.actor.userId === input.requestedBy) {
      throw new SiteLifecycleRequestError("SELF_REVIEW_FORBIDDEN");
    }
    return this.repository.reject({
      auditRequestId: input.auditRequestId,
      expectedRequestVersion: input.expectedRequestVersion,
      lifecycleRequestId: input.lifecycleRequestId,
      reason: normalizeReason(input.reason),
    });
  }

  async cancel(input: {
    action: string;
    actor: SiteLifecycleActor;
    auditRequestId: string;
    expectedRequestVersion: number;
    lifecycleRequestId: string;
    managementCompanyId: string;
    reason: string;
    requestedBy: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteLifecycleCommandResult> {
    assertAction(input.action);
    authorize(input.actor, requestPermission(input.action), input);
    assertRequestIdentity(input);
    assertUuid(input.requestedBy, "INVALID_USER_ID");
    if (input.actor.userId !== input.requestedBy) {
      throw new SiteLifecycleRequestError("REQUESTER_REQUIRED");
    }
    return this.repository.cancel({
      auditRequestId: input.auditRequestId,
      expectedRequestVersion: input.expectedRequestVersion,
      lifecycleRequestId: input.lifecycleRequestId,
      reason: normalizeReason(input.reason),
    });
  }
}
