import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";

export const SITE_CONTRACT_VEHICLE_LIMIT_MAX = 1_000_000;
export const DEFAULT_SITE_TIMEZONE = "Asia/Seoul";
export const SITE_TYPES = ["APARTMENT", "OFFICETEL", "BUILDING", "OTHER"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export interface SiteActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface SiteCommandResult {
  id: string;
  version: number;
}

export interface SiteManagementRepository {
  changeStatus(input: {
    expectedVersion: number;
    nextStatus: OrganizationStatus;
    reason: string;
    requestId: string;
    siteId: string;
  }): Promise<SiteCommandResult>;
  create(input: {
    address: string | null;
    contractVehicleLimit: number;
    managementCompanyId: string;
    name: string;
    reason: string;
    requestId: string;
    tenantId: string;
    timezone: string;
    type: SiteType;
  }): Promise<SiteCommandResult>;
  updateContract(input: {
    contractVehicleLimit: number;
    expectedVersion: number;
    reason: string;
    requestId: string;
    siteId: string;
  }): Promise<SiteCommandResult>;
  updateOperational(input: {
    address: string | null;
    expectedVersion: number;
    name: string;
    reason: string;
    requestId: string;
    siteId: string;
    timezone: string;
    type: SiteType;
  }): Promise<SiteCommandResult>;
}

export class SiteManagementError extends Error {
  readonly code:
    | "INVALID_ADDRESS"
    | "INVALID_COMPANY_ID"
    | "INVALID_CONTRACT_VEHICLE_LIMIT"
    | "INVALID_NAME"
    | "INVALID_REASON"
    | "INVALID_REQUEST_ID"
    | "INVALID_SITE_ID"
    | "INVALID_SITE_TYPE"
    | "INVALID_STATUS_TRANSITION"
    | "INVALID_TENANT_ID"
    | "INVALID_TIMEZONE"
    | "INVALID_USER_ID"
    | "INVALID_VERSION";

  constructor(code: SiteManagementError["code"]) {
    super(`Site command rejected: ${code}`);
    this.name = "SiteManagementError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(
  value: string,
  code:
    | "INVALID_COMPANY_ID"
    | "INVALID_REQUEST_ID"
    | "INVALID_SITE_ID"
    | "INVALID_TENANT_ID"
    | "INVALID_USER_ID",
): void {
  if (!UUID_PATTERN.test(value)) {
    throw new SiteManagementError(code);
  }
}

function normalizeName(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 200) {
    throw new SiteManagementError("INVALID_NAME");
  }
  return normalized;
}

function normalizeAddress(value: string): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > 500) {
    throw new SiteManagementError("INVALID_ADDRESS");
  }
  return normalized;
}

function normalizeTimezone(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 64) {
    throw new SiteManagementError("INVALID_TIMEZONE");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format();
  } catch {
    throw new SiteManagementError("INVALID_TIMEZONE");
  }
  return normalized;
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new SiteManagementError("INVALID_REASON");
  }
  return normalized;
}

function assertSiteType(value: string): asserts value is SiteType {
  if (!SITE_TYPES.some((type) => type === value)) {
    throw new SiteManagementError("INVALID_SITE_TYPE");
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new SiteManagementError("INVALID_VERSION");
  }
}

function assertContractVehicleLimit(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > SITE_CONTRACT_VEHICLE_LIMIT_MAX) {
    throw new SiteManagementError("INVALID_CONTRACT_VEHICLE_LIMIT");
  }
}

function authorizeActor(
  actor: SiteActor,
  permission:
    | "site:archive-approve"
    | "site:create"
    | "site:suspend-approve"
    | "site:update-contract"
    | "site:update-operational",
  resource: {
    managementCompanyId: string;
    siteId?: string;
    tenantId: string;
  },
): void {
  assertUuid(actor.userId, "INVALID_USER_ID");
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, resource));
}

function validateScope(input: {
  managementCompanyId: string;
  siteId?: string;
  tenantId: string;
}): void {
  assertUuid(input.tenantId, "INVALID_TENANT_ID");
  assertUuid(input.managementCompanyId, "INVALID_COMPANY_ID");
  if (input.siteId) {
    assertUuid(input.siteId, "INVALID_SITE_ID");
  }
}

export class SiteApplicationService {
  constructor(private readonly repository: SiteManagementRepository) {}

  async create(input: {
    actor: SiteActor;
    address: string;
    contractVehicleLimit: number;
    managementCompanyId: string;
    name: string;
    reason: string;
    requestId: string;
    tenantId: string;
    timezone: string;
    type: string;
  }): Promise<SiteCommandResult> {
    validateScope(input);
    authorizeActor(input.actor, "site:create", input);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertSiteType(input.type);
    assertContractVehicleLimit(input.contractVehicleLimit);
    return this.repository.create({
      address: normalizeAddress(input.address),
      contractVehicleLimit: input.contractVehicleLimit,
      managementCompanyId: input.managementCompanyId,
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      tenantId: input.tenantId,
      timezone: normalizeTimezone(input.timezone),
      type: input.type,
    });
  }

  async updateOperational(input: {
    actor: SiteActor;
    address: string;
    expectedVersion: number;
    managementCompanyId: string;
    name: string;
    reason: string;
    requestId: string;
    siteId: string;
    tenantId: string;
    timezone: string;
    type: string;
  }): Promise<SiteCommandResult> {
    validateScope(input);
    authorizeActor(input.actor, "site:update-operational", input);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    assertSiteType(input.type);
    return this.repository.updateOperational({
      address: normalizeAddress(input.address),
      expectedVersion: input.expectedVersion,
      name: normalizeName(input.name),
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      siteId: input.siteId,
      timezone: normalizeTimezone(input.timezone),
      type: input.type,
    });
  }

  async updateContract(input: {
    actor: SiteActor;
    contractVehicleLimit: number;
    expectedVersion: number;
    managementCompanyId: string;
    reason: string;
    requestId: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteCommandResult> {
    validateScope(input);
    authorizeActor(input.actor, "site:update-contract", input);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    assertContractVehicleLimit(input.contractVehicleLimit);
    return this.repository.updateContract({
      contractVehicleLimit: input.contractVehicleLimit,
      expectedVersion: input.expectedVersion,
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      siteId: input.siteId,
    });
  }

  async changeStatus(input: {
    actor: SiteActor;
    currentStatus: OrganizationStatus;
    expectedVersion: number;
    managementCompanyId: string;
    nextStatus: OrganizationStatus;
    reason: string;
    requestId: string;
    siteId: string;
    tenantId: string;
  }): Promise<SiteCommandResult> {
    validateScope(input);
    const permission =
      input.nextStatus === "CLOSED" ? "site:archive-approve" : "site:suspend-approve";
    authorizeActor(input.actor, permission, input);
    assertUuid(input.requestId, "INVALID_REQUEST_ID");
    assertVersion(input.expectedVersion);
    const validTransition =
      (input.currentStatus === "ACTIVE" &&
        (input.nextStatus === "SUSPENDED" || input.nextStatus === "CLOSED")) ||
      (input.currentStatus === "SUSPENDED" &&
        (input.nextStatus === "ACTIVE" || input.nextStatus === "CLOSED"));
    if (!validTransition) {
      throw new SiteManagementError("INVALID_STATUS_TRANSITION");
    }
    return this.repository.changeStatus({
      expectedVersion: input.expectedVersion,
      nextStatus: input.nextStatus,
      reason: normalizeReason(input.reason),
      requestId: input.requestId,
      siteId: input.siteId,
    });
  }
}
