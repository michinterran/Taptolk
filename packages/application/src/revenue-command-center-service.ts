import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RevenueActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface RevenueCompanyItem {
  activeQrCount: number;
  completedBatchCount: number;
  id: string;
  monthlyUnitPriceKrw: number | null;
  name: string;
  producedStickerCount: number;
  projectedMonthlyRevenueKrw: number;
  siteCount: number;
  tenantId: string;
}

export interface RevenueCommandCenterModel {
  activeQrCount: number;
  companies: readonly RevenueCompanyItem[];
  completedBatchCount: number;
  freshAt: string;
  managementCompanyCount: number;
  pricedCompanyCount: number;
  producedStickerCount: number;
  projectedMonthlyRevenueKrw: number;
  siteCount: number;
}

export interface RevenueCommandCenterRepository {
  read(): Promise<RevenueCommandCenterModel>;
  setMonthlyUnitPrice(input: {
    effectiveFrom: string;
    managementCompanyId: string;
    monthlyUnitPriceKrw: number;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<void>;
}

export class RevenueCommandCenterService {
  constructor(private readonly repository: RevenueCommandCenterRepository) {}

  async read(input: { actor: RevenueActor }): Promise<RevenueCommandCenterModel> {
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "audit:read", {
        tenantId: "platform-revenue",
      }),
    );
    return this.repository.read();
  }

  async setMonthlyUnitPrice(input: {
    actor: RevenueActor;
    effectiveFrom: string;
    managementCompanyId: string;
    monthlyUnitPriceKrw: number;
    reason: string;
    requestId: string;
    tenantId: string;
  }): Promise<void> {
    if (
      !UUID_PATTERN.test(input.actor.userId) ||
      !UUID_PATTERN.test(input.tenantId) ||
      !UUID_PATTERN.test(input.managementCompanyId) ||
      !UUID_PATTERN.test(input.requestId) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(input.effectiveFrom) ||
      !Number.isInteger(input.monthlyUnitPriceKrw) ||
      input.monthlyUnitPriceKrw < 0 ||
      input.monthlyUnitPriceKrw > 1_000_000 ||
      input.reason.trim().length < 3 ||
      input.reason.trim().length > 500
    ) {
      throw new Error("INVALID_REVENUE_PRICING");
    }
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "tenant:update", {
        tenantId: input.tenantId,
      }),
    );
    await this.repository.setMonthlyUnitPrice({
      effectiveFrom: input.effectiveFrom,
      managementCompanyId: input.managementCompanyId,
      monthlyUnitPriceKrw: input.monthlyUnitPriceKrw,
      reason: input.reason.trim(),
      requestId: input.requestId,
      tenantId: input.tenantId,
    });
  }
}
