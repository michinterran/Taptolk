import {
  type AdminAuthorizationContext,
  type AuthorizationDecision,
  authorizeAdminAction,
  type ResourceScope,
} from "@taptolk/domain";

export interface SiteRecord extends ResourceScope {
  contractVehicleLimit: number;
  id: string;
  managementCompanyId: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  type: "APARTMENT" | "OFFICETEL" | "BUILDING" | "OTHER";
  version: number;
}

export interface CreateSiteCommand {
  actor: AdminAuthorizationContext;
  actorId: string;
  contractVehicleLimit: number;
  managementCompanyId: string;
  name: string;
  requestId: string;
  tenantId: string;
  type: SiteRecord["type"];
}

export interface UpdateSiteCommand {
  actor: AdminAuthorizationContext;
  actorId: string;
  expectedVersion: number;
  name: string;
  requestId: string;
  site: SiteRecord;
}

export interface ArchiveSiteCommand {
  actor: AdminAuthorizationContext;
  actorId: string;
  expectedVersion: number;
  reason: string;
  requestId: string;
  site: SiteRecord;
}

export interface AuditEventInput {
  action: "SITE_ARCHIVED" | "SITE_CREATED" | "SITE_UPDATED";
  actorId: string;
  afterData: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  requestId: string;
  resourceId: string;
  tenantId: string;
}

export interface SiteUnitOfWork {
  appendAudit(event: AuditEventInput): Promise<void>;
  archiveSite(site: SiteRecord, expectedVersion: number): Promise<SiteRecord>;
  createSite(command: Omit<CreateSiteCommand, "actor">): Promise<SiteRecord>;
  updateSite(
    site: SiteRecord,
    changes: { name: string },
    expectedVersion: number,
  ): Promise<SiteRecord>;
}

export interface SiteTransactionManager {
  execute<T>(operation: (unitOfWork: SiteUnitOfWork) => Promise<T>): Promise<T>;
}

export class AdminAuthorizationError extends Error {
  readonly code: Exclude<AuthorizationDecision, { allowed: true }>["reason"];

  constructor(code: Exclude<AuthorizationDecision, { allowed: true }>["reason"]) {
    super(`Admin action denied: ${code}`);
    this.name = "AdminAuthorizationError";
    this.code = code;
  }
}

function assertAuthorized(decision: AuthorizationDecision): void {
  if (!decision.allowed) {
    throw new AdminAuthorizationError(decision.reason);
  }
}

function normalizeSiteName(name: string): string {
  const normalized = name.trim();
  if (normalized.length < 1 || normalized.length > 200) {
    throw new Error("Site name must contain 1 to 200 characters.");
  }
  return normalized;
}

function scopeOf(site: SiteRecord): ResourceScope {
  return {
    managementCompanyId: site.managementCompanyId,
    siteId: site.id,
    tenantId: site.tenantId,
  };
}

export class SiteApplicationService {
  constructor(private readonly transactions: SiteTransactionManager) {}

  async create(command: CreateSiteCommand): Promise<SiteRecord> {
    const resource = {
      managementCompanyId: command.managementCompanyId,
      tenantId: command.tenantId,
    };
    assertAuthorized(authorizeAdminAction(command.actor, "site:create", resource));
    if (!Number.isInteger(command.contractVehicleLimit) || command.contractVehicleLimit < 0) {
      throw new Error("Contract vehicle limit must be a non-negative integer.");
    }

    return this.transactions.execute(async (unitOfWork) => {
      const site = await unitOfWork.createSite({
        actorId: command.actorId,
        contractVehicleLimit: command.contractVehicleLimit,
        managementCompanyId: command.managementCompanyId,
        name: normalizeSiteName(command.name),
        requestId: command.requestId,
        tenantId: command.tenantId,
        type: command.type,
      });
      await unitOfWork.appendAudit({
        action: "SITE_CREATED",
        actorId: command.actorId,
        afterData: {
          name: site.name,
          status: site.status,
          type: site.type,
        },
        requestId: command.requestId,
        resourceId: site.id,
        tenantId: site.tenantId,
      });
      return site;
    });
  }

  async update(command: UpdateSiteCommand): Promise<SiteRecord> {
    assertAuthorized(
      authorizeAdminAction(command.actor, "site:update-operational", scopeOf(command.site)),
    );
    const nextName = normalizeSiteName(command.name);

    return this.transactions.execute(async (unitOfWork) => {
      const updated = await unitOfWork.updateSite(
        command.site,
        { name: nextName },
        command.expectedVersion,
      );
      await unitOfWork.appendAudit({
        action: "SITE_UPDATED",
        actorId: command.actorId,
        afterData: { name: updated.name, version: updated.version },
        beforeData: { name: command.site.name, version: command.site.version },
        requestId: command.requestId,
        resourceId: updated.id,
        tenantId: updated.tenantId,
      });
      return updated;
    });
  }

  async archive(command: ArchiveSiteCommand): Promise<SiteRecord> {
    assertAuthorized(
      authorizeAdminAction(command.actor, "site:archive-approve", scopeOf(command.site)),
    );
    if (command.reason.trim().length < 3) {
      throw new Error("Archiving a Site requires a reason.");
    }

    return this.transactions.execute(async (unitOfWork) => {
      const archived = await unitOfWork.archiveSite(command.site, command.expectedVersion);
      await unitOfWork.appendAudit({
        action: "SITE_ARCHIVED",
        actorId: command.actorId,
        afterData: { status: archived.status, version: archived.version },
        beforeData: { status: command.site.status, version: command.site.version },
        requestId: command.requestId,
        resourceId: archived.id,
        tenantId: archived.tenantId,
      });
      return archived;
    });
  }
}
