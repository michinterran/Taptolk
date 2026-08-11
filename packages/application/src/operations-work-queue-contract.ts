import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * These are source-backed queue categories. They must not be expanded with
 * synthetic operational states until a persisted command source exists.
 */
export type OperationsWorkItemKind =
  | "CONTACT_REQUEST"
  | "UNANSWERED_CONTACT"
  | "NOTIFICATION_FAILURE"
  | "ESCALATION"
  | "REPORT_REVIEW";

export type OperationsWorkItemAction = "OPEN_REPORT" | "OPEN_SITE_WORKSPACE";

export type OperationsWorkQueueState =
  | "WAITING"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "RETRY_PENDING";

export type OperationsWorkQueuePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type OperationsWorkQueueSource =
  | "CONTACT_SESSIONS"
  | "CONTACT_REPORTS"
  | "NOTIFICATION_DELIVERIES";

export interface OperationsWorkQueueScope {
  managementCompanyId?: string;
  siteId?: string;
  tenantId?: string;
}

export interface OperationsWorkQueueActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface OperationsWorkItem {
  actions: readonly OperationsWorkItemAction[];
  assigneeDisplayName: string | null;
  createdAt: string;
  elapsedSeconds: number;
  id: string;
  kind: OperationsWorkItemKind;
  queueState: OperationsWorkQueueState;
  lastAttemptAt: string | null;
  managementCompanyName: string;
  priority: OperationsWorkQueuePriority | null;
  siteId: string;
  siteName: string;
  source: OperationsWorkQueueSource;
  sourceStatus: string;
  sourceVersion: number | null;
  version: number;
  /** SLA remains absent until a real policy and due timestamp are persisted. */
  sla: string | null;
}

export interface OperationsWorkQueueModel {
  asOf: string;
  hasMore: boolean;
  items: readonly OperationsWorkItem[];
  nextCursor: string | null;
}

export interface OperationsWorkQueueReadRequest {
  actor: OperationsWorkQueueActor;
  scope: OperationsWorkQueueScope;
}

export type OperationsWorkQueueMutation =
  | OperationsWorkQueueStateMutation
  | OperationsWorkQueueAssignmentMutation;

export interface OperationsWorkQueueMutationRequest {
  actor: OperationsWorkQueueActor;
  mutation: OperationsWorkQueueMutation;
  scope: OperationsWorkQueueScope;
}

export type OperationsWorkQueueStateMutation = {
  expectedVersion: number;
  itemId: string;
  kind: OperationsWorkItemKind;
  reason: string;
  requestId: string;
  type: "ACKNOWLEDGE" | "START" | "RESOLVE" | "RETRY";
};

export type OperationsWorkQueueAssignmentMutation = {
  assigneeMembershipId?: string;
  expectedVersion: number;
  itemId: string;
  kind: OperationsWorkItemKind;
  reason: string;
  requestId: string;
  type: "ASSIGN";
};

export interface OperationsWorkQueueRepository {
  read(input: OperationsWorkQueueReadRequest): Promise<OperationsWorkQueueModel>;
  mutate(input: OperationsWorkQueueMutationRequest): Promise<OperationsWorkQueueModel>;
}

export class OperationsWorkQueueService {
  constructor(private readonly repository: OperationsWorkQueueRepository) {}

  async read(input: {
    actor: OperationsWorkQueueActor;
    scope?: OperationsWorkQueueScope;
  }): Promise<OperationsWorkQueueModel> {
    if (!UUID_PATTERN.test(input.actor.userId)) {
      throw new Error("INVALID_ID");
    }
    const scope = input.scope ?? {};
    if (
      (scope.tenantId && !UUID_PATTERN.test(scope.tenantId)) ||
      (scope.managementCompanyId && !UUID_PATTERN.test(scope.managementCompanyId)) ||
      (scope.siteId && !UUID_PATTERN.test(scope.siteId))
    ) {
      throw new Error("INVALID_OPERATIONS_WORK_QUEUE_SCOPE");
    }
    const actorScope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "audit:read", {
        ...(scope.managementCompanyId
          ? { managementCompanyId: scope.managementCompanyId }
          : actorScope.managementCompanyId
            ? { managementCompanyId: actorScope.managementCompanyId }
            : {}),
        ...(scope.siteId
          ? { siteId: scope.siteId }
          : actorScope.siteId
            ? { siteId: actorScope.siteId }
            : {}),
        tenantId: scope.tenantId ?? actorScope.tenantId ?? "platform-operations",
      }),
    );
    return this.repository.read({ actor: input.actor, scope });
  }

  async mutate(input: OperationsWorkQueueMutationRequest): Promise<OperationsWorkQueueModel> {
    if (!UUID_PATTERN.test(input.actor.userId)) {
      throw new Error("INVALID_ID");
    }
    const scope = input.scope ?? {};
    if (
      (scope.tenantId && !UUID_PATTERN.test(scope.tenantId)) ||
      (scope.managementCompanyId && !UUID_PATTERN.test(scope.managementCompanyId)) ||
      (scope.siteId && !UUID_PATTERN.test(scope.siteId))
    ) {
      throw new Error("INVALID_OPERATIONS_WORK_QUEUE_SCOPE");
    }
    assertOperationsWorkQueueMutation(input.mutation);
    const actorScope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "operations:manage", {
        ...(scope.managementCompanyId
          ? { managementCompanyId: scope.managementCompanyId }
          : actorScope.managementCompanyId
            ? { managementCompanyId: actorScope.managementCompanyId }
            : {}),
        ...(scope.siteId
          ? { siteId: scope.siteId }
          : actorScope.siteId
            ? { siteId: actorScope.siteId }
            : {}),
        tenantId: scope.tenantId ?? actorScope.tenantId ?? "platform-operations",
      }),
    );
    return this.repository.mutate({ actor: input.actor, mutation: input.mutation, scope });
  }
}

export function assertOperationsWorkQueueMutation(input: OperationsWorkQueueMutation): void {
  if (
    !UUID_PATTERN.test(input.itemId) ||
    !UUID_PATTERN.test(input.requestId) ||
    ![
      "CONTACT_REQUEST",
      "UNANSWERED_CONTACT",
      "NOTIFICATION_FAILURE",
      "ESCALATION",
      "REPORT_REVIEW",
    ].includes(input.kind) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 500
  ) {
    throw new Error("INVALID_OPERATIONS_WORK_QUEUE_MUTATION");
  }
  if (
    input.type === "ASSIGN" &&
    input.assigneeMembershipId &&
    !UUID_PATTERN.test(input.assigneeMembershipId)
  ) {
    throw new Error("INVALID_OPERATIONS_WORK_QUEUE_ASSIGNEE");
  }
}
