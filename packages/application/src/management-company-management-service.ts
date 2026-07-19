import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";

export interface ManagementCompanyActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface ManagementCompanyCommandResult {
  id: string;
  version: number;
}

export interface ManagementCompanyManagementRepository {
  changeStatus(input: {
    companyId: string;
    expectedVersion: number;
    nextStatus: OrganizationStatus;
    reason: string;
    requestId: string;
  }): Promise<ManagementCompanyCommandResult>;
  create(input: {
    businessNumber: string | null;
    name: string;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<ManagementCompanyCommandResult>;
  update(input: {
    businessNumber: string | null;
    companyId: string;
    expectedVersion: number;
    name: string;
    reason: string;
    requestId: string;
  }): Promise<ManagementCompanyCommandResult>;
}

export class ManagementCompanyManagementError extends Error {
  readonly code:
    | "INVALID_BUSINESS_NUMBER"
    | "INVALID_COMPANY_ID"
    | "INVALID_NAME"
    | "INVALID_REASON"
    | "INVALID_REQUEST_ID"
    | "INVALID_STATUS_TRANSITION"
    | "INVALID_TENANT_ID"
    | "INVALID_USER_ID"
    | "INVALID_VERSION";

  constructor(code: ManagementCompanyManagementError["code"]) {
    super(`Management Company command rejected: ${code}`);
    this.name = "ManagementCompanyManagementError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(
  value: string,
  code: "INVALID_COMPANY_ID" | "INVALID_REQUEST_ID" | "INVALID_TENANT_ID" | "INVALID_USER_ID",
): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ManagementCompanyManagementError(code);
  }
}

function normalizeName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 200) {
    throw new ManagementCompanyManagementError("INVALID_NAME");
  }
  return name;
}

function normalizeBusinessNumber(value: string): string | null {
  const candidate = value.trim();
  if (candidate.length === 0) {
    return null;
  }
  if (!/^[0-9\s-]+$/u.test(candidate)) {
    throw new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER");
  }
  const normalized = candidate.replaceAll(/[\s-]/gu, "");
  if (!/^[0-9]{10}$/u.test(normalized)) {
    throw new ManagementCompanyManagementError("INVALID_BUSINESS_NUMBER");
  }
  return normalized;
}

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new ManagementCompanyManagementError("INVALID_REASON");
  }
  return reason;
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new ManagementCompanyManagementError("INVALID_VERSION");
  }
}

function authorizeActor(
  actor: ManagementCompanyActor,
  permission:
    | "management-company:close"
    | "management-company:create"
    | "management-company:suspend"
    | "management-company:update",
  tenantId: string,
): void {
  assertUuid(actor.userId, "INVALID_USER_ID");
  if (actor.authorization.scope.type !== "PLATFORM") {
    throw new AdminAuthorizationError("OUT_OF_SCOPE");
  }
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, { tenantId }));
}

export class ManagementCompanyManagementService {
  constructor(private readonly repository: ManagementCompanyManagementRepository) {}

  async create(input: {
    actor: ManagementCompanyActor;
    businessNumber: string;
    name: string;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<ManagementCompanyCommandResult> {
    assertUuid(input.tenantId, "INVALID_TENANT_ID");
    authorizeActor(input.actor, "management-company:create", input.tenantId);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    return this.repository.create({
      businessNumber: normalizeBusinessNumber(input.businessNumber),
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      tenantId: input.tenantId,
    });
  }

  async update(input: {
    actor: ManagementCompanyActor;
    businessNumber: string;
    companyId: string;
    expectedVersion: number;
    name: string;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<ManagementCompanyCommandResult> {
    assertUuid(input.tenantId, "INVALID_TENANT_ID");
    assertUuid(input.companyId, "INVALID_COMPANY_ID");
    authorizeActor(input.actor, "management-company:update", input.tenantId);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    return this.repository.update({
      businessNumber: normalizeBusinessNumber(input.businessNumber),
      companyId: input.companyId,
      expectedVersion: input.expectedVersion,
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
    });
  }

  async changeStatus(input: {
    actor: ManagementCompanyActor;
    companyId: string;
    currentStatus: OrganizationStatus;
    expectedVersion: number;
    nextStatus: OrganizationStatus;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<ManagementCompanyCommandResult> {
    assertUuid(input.tenantId, "INVALID_TENANT_ID");
    assertUuid(input.companyId, "INVALID_COMPANY_ID");
    const permission =
      input.nextStatus === "CLOSED"
        ? "management-company:close"
        : input.nextStatus === "SUSPENDED"
          ? "management-company:suspend"
          : "management-company:update";
    authorizeActor(input.actor, permission, input.tenantId);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    const validTransition =
      (input.currentStatus === "ACTIVE" &&
        (input.nextStatus === "SUSPENDED" || input.nextStatus === "CLOSED")) ||
      (input.currentStatus === "SUSPENDED" &&
        (input.nextStatus === "ACTIVE" || input.nextStatus === "CLOSED"));
    if (!validTransition) {
      throw new ManagementCompanyManagementError("INVALID_STATUS_TRANSITION");
    }
    return this.repository.changeStatus({
      companyId: input.companyId,
      expectedVersion: input.expectedVersion,
      nextStatus: input.nextStatus,
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
    });
  }
}
