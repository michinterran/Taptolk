import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";
import type { TenantStatus } from "./tenant-catalog-service.js";

export interface TenantManagementActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface TenantCommandResult {
  id: string;
  version: number;
}

export interface TenantManagementRepository {
  create(input: {
    name: string;
    reason: string;
    requestId: string;
    slug: string;
  }): Promise<TenantCommandResult>;
  update(input: {
    expectedVersion: number;
    name: string;
    reason: string;
    requestId: string;
    slug: string;
    tenantId: string;
  }): Promise<TenantCommandResult>;
  changeStatus(input: {
    expectedVersion: number;
    nextStatus: TenantStatus;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<TenantCommandResult>;
}

export class TenantManagementError extends Error {
  readonly code:
    | "INVALID_NAME"
    | "INVALID_REASON"
    | "INVALID_REQUEST_ID"
    | "INVALID_SLUG"
    | "INVALID_STATUS_TRANSITION"
    | "INVALID_TENANT_ID"
    | "INVALID_USER_ID"
    | "INVALID_VERSION";

  constructor(code: TenantManagementError["code"]) {
    super(`Tenant management command rejected: ${code}`);
    this.name = "TenantManagementError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/u;

function normalizeName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 200) {
    throw new TenantManagementError("INVALID_NAME");
  }
  return name;
}

function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 63 || !SLUG_PATTERN.test(slug)) {
    throw new TenantManagementError("INVALID_SLUG");
  }
  return slug;
}

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new TenantManagementError("INVALID_REASON");
  }
  return reason;
}

function assertUuid(
  value: string,
  code: "INVALID_REQUEST_ID" | "INVALID_TENANT_ID" | "INVALID_USER_ID",
): void {
  if (!UUID_PATTERN.test(value)) {
    throw new TenantManagementError(code);
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TenantManagementError("INVALID_VERSION");
  }
}

function authorizeActor(
  actor: TenantManagementActor,
  permission: "tenant:close" | "tenant:create" | "tenant:suspend" | "tenant:update",
  tenantId: string,
): void {
  assertUuid(actor.userId, "INVALID_USER_ID");
  if (actor.authorization.scope.type !== "PLATFORM") {
    throw new AdminAuthorizationError("OUT_OF_SCOPE");
  }
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, { tenantId }));
}

export class TenantManagementService {
  constructor(private readonly repository: TenantManagementRepository) {}

  async create(input: {
    actor: TenantManagementActor;
    name: string;
    reason: string;
    requestId: string;
    slug: string;
  }): Promise<TenantCommandResult> {
    authorizeActor(input.actor, "tenant:create", "platform-tenant-create");
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    return this.repository.create({
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      slug: normalizeSlug(input.slug),
    });
  }

  async update(input: {
    actor: TenantManagementActor;
    expectedVersion: number;
    name: string;
    reason: string;
    requestId: string;
    slug: string;
    tenantId: string;
  }): Promise<TenantCommandResult> {
    assertUuid(input.tenantId, "INVALID_TENANT_ID");
    authorizeActor(input.actor, "tenant:update", input.tenantId);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    return this.repository.update({
      expectedVersion: input.expectedVersion,
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      slug: normalizeSlug(input.slug),
      tenantId: input.tenantId,
    });
  }

  async changeStatus(input: {
    actor: TenantManagementActor;
    currentStatus: TenantStatus;
    expectedVersion: number;
    nextStatus: TenantStatus;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<TenantCommandResult> {
    assertUuid(input.tenantId, "INVALID_TENANT_ID");
    const permission = input.nextStatus === "CLOSED" ? "tenant:close" : "tenant:suspend";
    authorizeActor(input.actor, permission, input.tenantId);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    const validTransition =
      (input.currentStatus === "ACTIVE" &&
        (input.nextStatus === "SUSPENDED" || input.nextStatus === "CLOSED")) ||
      (input.currentStatus === "SUSPENDED" &&
        (input.nextStatus === "ACTIVE" || input.nextStatus === "CLOSED"));
    if (!validTransition) {
      throw new TenantManagementError("INVALID_STATUS_TRANSITION");
    }
    return this.repository.changeStatus({
      expectedVersion: input.expectedVersion,
      nextStatus: input.nextStatus,
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      tenantId: input.tenantId,
    });
  }
}
