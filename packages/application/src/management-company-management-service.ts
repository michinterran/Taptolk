import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";

export interface ManagementCompanyActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface ManagementCompanyCommandResult {
  id: string;
  tenantId?: string;
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
    address: string | null;
    businessNumber: string | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhoneEncrypted: string | null;
    name: string;
    operationsManagerEmail: string | null;
    operationsManagerName: string | null;
    operationsManagerPhoneEncrypted: string | null;
    representativePhoneEncrypted: string | null;
    reason: string;
    requestId: string;
  }): Promise<ManagementCompanyCommandResult>;
  update(input: {
    address: string | null;
    businessNumber: string | null;
    companyId: string;
    contactEmail: string | null;
    contactName: string | null;
    contactPhoneEncrypted: string | null;
    expectedVersion: number;
    name: string;
    operationsManagerEmail: string | null;
    operationsManagerName: string | null;
    operationsManagerPhoneEncrypted: string | null;
    representativePhoneEncrypted: string | null;
    reason: string;
    requestId: string;
  }): Promise<ManagementCompanyCommandResult>;
}

export class ManagementCompanyManagementError extends Error {
  readonly code:
    | "INVALID_BUSINESS_NUMBER"
    | "INVALID_COMPANY_ID"
    | "INVALID_ADDRESS"
    | "INVALID_CONTACT_EMAIL"
    | "INVALID_CONTACT_NAME"
    | "INVALID_NAME"
    | "INVALID_MANAGEMENT_CODE"
    | "INVALID_OPERATIONS_MANAGER_EMAIL"
    | "INVALID_OPERATIONS_MANAGER_NAME"
    | "INVALID_PROTECTED_PHONE"
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

function normalizeOptionalText(
  value: string,
  code: "INVALID_ADDRESS" | "INVALID_MANAGEMENT_CODE",
  min: number,
  max: number,
): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length < min || normalized.length > max) {
    throw new ManagementCompanyManagementError(code);
  }
  return normalized;
}

function normalizeOptionalName(
  value: string,
  code: "INVALID_CONTACT_NAME" | "INVALID_OPERATIONS_MANAGER_NAME",
): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > 100) {
    throw new ManagementCompanyManagementError(code);
  }
  return normalized;
}

function normalizeOptionalEmail(
  value: string,
  code: "INVALID_CONTACT_EMAIL" | "INVALID_OPERATIONS_MANAGER_EMAIL",
): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(normalized)) {
    throw new ManagementCompanyManagementError(code);
  }
  return normalized;
}

function normalizeProtectedPhone(value: string): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length < 10 || normalized.length > 1000) {
    throw new ManagementCompanyManagementError("INVALID_PROTECTED_PHONE");
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
    address: string;
    actor: ManagementCompanyActor;
    businessNumber: string;
    contactEmail: string;
    contactName: string;
    contactPhoneEncrypted: string;
    name: string;
    operationsManagerEmail: string;
    operationsManagerName: string;
    operationsManagerPhoneEncrypted: string;
    representativePhoneEncrypted: string;
    reason: string;
    requestId: string;
  }): Promise<ManagementCompanyCommandResult> {
    authorizeActor(input.actor, "management-company:create", "platform-management-company-create");
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    return this.repository.create({
      address: normalizeOptionalText(input.address, "INVALID_ADDRESS", 2, 300),
      businessNumber: normalizeBusinessNumber(input.businessNumber),
      contactEmail: normalizeOptionalEmail(input.contactEmail, "INVALID_CONTACT_EMAIL"),
      contactName: normalizeOptionalName(input.contactName, "INVALID_CONTACT_NAME"),
      contactPhoneEncrypted: normalizeProtectedPhone(input.contactPhoneEncrypted),
      name: normalizeName(input.name),
      operationsManagerEmail: normalizeOptionalEmail(
        input.operationsManagerEmail,
        "INVALID_OPERATIONS_MANAGER_EMAIL",
      ),
      operationsManagerName: normalizeOptionalName(
        input.operationsManagerName,
        "INVALID_OPERATIONS_MANAGER_NAME",
      ),
      operationsManagerPhoneEncrypted: normalizeProtectedPhone(
        input.operationsManagerPhoneEncrypted,
      ),
      representativePhoneEncrypted: normalizeProtectedPhone(input.representativePhoneEncrypted),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
    });
  }

  async update(input: {
    address: string;
    actor: ManagementCompanyActor;
    businessNumber: string;
    companyId: string;
    contactEmail: string;
    contactName: string;
    contactPhoneEncrypted: string;
    expectedVersion: number;
    name: string;
    operationsManagerEmail: string;
    operationsManagerName: string;
    operationsManagerPhoneEncrypted: string;
    representativePhoneEncrypted: string;
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
      address: normalizeOptionalText(input.address, "INVALID_ADDRESS", 2, 300),
      businessNumber: normalizeBusinessNumber(input.businessNumber),
      companyId: input.companyId,
      contactEmail: normalizeOptionalEmail(input.contactEmail, "INVALID_CONTACT_EMAIL"),
      contactName: normalizeOptionalName(input.contactName, "INVALID_CONTACT_NAME"),
      contactPhoneEncrypted: normalizeProtectedPhone(input.contactPhoneEncrypted),
      expectedVersion: input.expectedVersion,
      name: normalizeName(input.name),
      operationsManagerEmail: normalizeOptionalEmail(
        input.operationsManagerEmail,
        "INVALID_OPERATIONS_MANAGER_EMAIL",
      ),
      operationsManagerName: normalizeOptionalName(
        input.operationsManagerName,
        "INVALID_OPERATIONS_MANAGER_NAME",
      ),
      operationsManagerPhoneEncrypted: normalizeProtectedPhone(
        input.operationsManagerPhoneEncrypted,
      ),
      representativePhoneEncrypted: normalizeProtectedPhone(input.representativePhoneEncrypted),
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
