import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface OperationsDashboardActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface OperationsDailyPoint {
  contactCount: number;
  date: string;
  escalatedCount: number;
  notificationFailedCount: number;
  notificationSentCount: number;
  unresolvedCount: number;
}

export interface OperationsSitePerformance {
  activeQrCount: number;
  contactCount: number;
  siteId: string;
  siteName: string;
  unresolvedCount: number;
}

export interface OperationsDashboardScope {
  days?: number;
  endDate?: string;
  managementCompanyId?: string;
  siteId?: string;
  startDate?: string;
}

export interface OperationsDashboardModel {
  activeBlockCount: number;
  activeQrCount: number;
  completedBatchCount: number;
  contactCount: number;
  escalatedCount: number;
  freshAt: string;
  latestSnapshotAt: string | null;
  medianOwnerResponseMs: number | null;
  notificationFailedCount: number;
  notificationMissingCostCount: number;
  notificationRecordedCost: number;
  notificationRetryCount: number;
  notificationSentCount: number;
  openReportCount: number;
  siteCount: number;
  unresolvedCount: number;
  dailySeries: readonly OperationsDailyPoint[];
  scopeManagementCompanyName: string | null;
  scopeSiteName: string | null;
  sitePerformance: readonly OperationsSitePerformance[];
  windowDays: number;
}

export interface OperationsDashboardRepository {
  read(scope: OperationsDashboardScope): Promise<OperationsDashboardModel>;
}

export class OperationsDashboardService {
  constructor(private readonly repository: OperationsDashboardRepository) {}

  async read(input: {
    actor: OperationsDashboardActor;
    scope?: OperationsDashboardScope;
  }): Promise<OperationsDashboardModel> {
    if (!UUID_PATTERN.test(input.actor.userId)) {
      throw new Error("INVALID_ID");
    }
    const requested = input.scope ?? {};
    const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
    const hasDateRange = requested.startDate !== undefined || requested.endDate !== undefined;
    if (
      (requested.managementCompanyId && !UUID_PATTERN.test(requested.managementCompanyId)) ||
      (requested.siteId && !UUID_PATTERN.test(requested.siteId)) ||
      (requested.days !== undefined &&
        (!Number.isInteger(requested.days) || requested.days < 7 || requested.days > 90)) ||
      (hasDateRange &&
        (!requested.startDate ||
          !requested.endDate ||
          !datePattern.test(requested.startDate) ||
          !datePattern.test(requested.endDate) ||
          requested.startDate > requested.endDate))
    ) {
      throw new Error("INVALID_OPERATIONS_SCOPE");
    }
    const actorScope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "audit:read", {
        ...(requested.managementCompanyId
          ? { managementCompanyId: requested.managementCompanyId }
          : actorScope.managementCompanyId
            ? { managementCompanyId: actorScope.managementCompanyId }
            : {}),
        ...(requested.siteId
          ? { siteId: requested.siteId }
          : actorScope.siteId
            ? { siteId: actorScope.siteId }
            : {}),
        tenantId: actorScope.tenantId ?? "platform-operations",
      }),
    );
    return this.repository.read(requested);
  }
}

export interface PrivacyCleanupResult {
  expiredSessionCount: number;
  redactedMessageCount: number;
  revokedBlockCount: number;
  revokedTokenCount: number;
  runId: string;
  status: "SUCCESS";
}

export interface PrivacyCleanupRepository {
  run(input: {
    blockGraceHours: number;
    messageRetentionHours: number;
    requestId: string;
    tenantId: string;
    tokenGraceHours: number;
  }): Promise<PrivacyCleanupResult>;
}

export class PrivacyCleanupService {
  constructor(private readonly repository: PrivacyCleanupRepository) {}

  async run(input: {
    blockGraceHours: number;
    messageRetentionHours: number;
    requestId: string;
    tenantId: string;
    tokenGraceHours: number;
  }): Promise<PrivacyCleanupResult> {
    if (!UUID_PATTERN.test(input.tenantId) || !UUID_PATTERN.test(input.requestId)) {
      throw new Error("INVALID_ID");
    }
    if (
      !Number.isInteger(input.messageRetentionHours) ||
      input.messageRetentionHours < 24 ||
      input.messageRetentionHours > 8_760 ||
      !Number.isInteger(input.tokenGraceHours) ||
      input.tokenGraceHours < 0 ||
      input.tokenGraceHours > 168 ||
      !Number.isInteger(input.blockGraceHours) ||
      input.blockGraceHours < 0 ||
      input.blockGraceHours > 168
    ) {
      throw new Error("INVALID_RETENTION_POLICY");
    }
    return this.repository.run(input);
  }
}
