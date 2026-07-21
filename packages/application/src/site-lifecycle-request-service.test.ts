import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import {
  SiteLifecycleRequestError,
  type SiteLifecycleRequestItem,
  type SiteLifecycleRequestRepository,
  SiteLifecycleRequestService,
} from "./site-lifecycle-request-service.js";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  company: "00000000-0000-4000-8000-000000000002",
  other: "00000000-0000-4000-8000-000000000003",
  request: "00000000-0000-4000-8000-000000000004",
  site: "00000000-0000-4000-8000-000000000005",
  tenant: "00000000-0000-4000-8000-000000000006",
} as const;

function actor(
  role: AdminAuthorizationContext["role"],
  mfaVerified = true,
): {
  authorization: AdminAuthorizationContext;
  userId: string;
} {
  const scope =
    role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR"
      ? { type: "PLATFORM" as const }
      : role === "MANAGEMENT_ADMIN"
        ? {
            managementCompanyId: IDS.company,
            tenantId: IDS.tenant,
            type: "MANAGEMENT_COMPANY" as const,
          }
        : {
            managementCompanyId: IDS.company,
            siteId: IDS.site,
            tenantId: IDS.tenant,
            type: "SITE" as const,
          };
  return { authorization: { mfaVerified, role, scope }, userId: IDS.actor };
}

function pending(overrides: Partial<SiteLifecycleRequestItem> = {}): SiteLifecycleRequestItem {
  return {
    action: "SUSPEND",
    createdAt: "2026-07-19T00:00:00.000Z",
    id: IDS.request,
    managementCompanyId: IDS.company,
    managementCompanyName: "Company",
    reason: "Operational review",
    requestedBy: IDS.other,
    requestedSiteVersion: 1,
    siteId: IDS.site,
    siteName: "Site",
    status: "PENDING",
    tenantId: IDS.tenant,
    tenantName: "Tenant",
    version: 1,
    ...overrides,
  };
}

function repository(
  requests: readonly SiteLifecycleRequestItem[] = [],
): SiteLifecycleRequestRepository {
  const result = {
    requestId: IDS.request,
    requestVersion: 1,
    siteId: IDS.site,
    siteVersion: null,
  };
  return {
    approve: vi.fn().mockResolvedValue({ ...result, requestVersion: 2, siteVersion: 2 }),
    cancel: vi.fn().mockResolvedValue({ ...result, requestVersion: 2 }),
    listPending: vi.fn().mockResolvedValue(requests),
    reject: vi.fn().mockResolvedValue({ ...result, requestVersion: 2 }),
    request: vi.fn().mockResolvedValue(result),
  };
}

describe("SiteLifecycleRequestService", () => {
  it("lets a Management Admin request suspend in its company scope", async () => {
    const repo = repository();
    const service = new SiteLifecycleRequestService(repo);

    await service.request({
      action: "SUSPEND",
      actor: actor("MANAGEMENT_ADMIN"),
      auditRequestId: IDS.request,
      currentStatus: "ACTIVE",
      expectedSiteVersion: 1,
      managementCompanyId: IDS.company,
      reason: "  Safety inspection  ",
      siteId: IDS.site,
      tenantId: IDS.tenant,
    });

    expect(repo.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SUSPEND", reason: "Safety inspection" }),
    );
  });

  it("keeps Site Admin close outside the approved request matrix", async () => {
    const service = new SiteLifecycleRequestService(repository());

    await expect(
      service.request({
        action: "CLOSE",
        actor: actor("SITE_ADMIN"),
        auditRequestId: IDS.request,
        currentStatus: "ACTIVE",
        expectedSiteVersion: 1,
        managementCompanyId: IDS.company,
        reason: "Contract closure",
        siteId: IDS.site,
        tenantId: IDS.tenant,
      }),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
  });

  it("rejects invalid action and Site status combinations", async () => {
    const service = new SiteLifecycleRequestService(repository());

    await expect(
      service.request({
        action: "REACTIVATE",
        actor: actor("MANAGEMENT_ADMIN"),
        auditRequestId: IDS.request,
        currentStatus: "ACTIVE",
        expectedSiteVersion: 1,
        managementCompanyId: IDS.company,
        reason: "Restore operations",
        siteId: IDS.site,
        tenantId: IDS.tenant,
      }),
    ).rejects.toEqual(new SiteLifecycleRequestError("INVALID_STATUS_TRANSITION"));
  });

  it("allows customer request roles without MFA under the current pilot policy", async () => {
    const service = new SiteLifecycleRequestService(repository());

    await expect(
      service.request({
        action: "SUSPEND",
        actor: actor("MANAGEMENT_ADMIN", false),
        auditRequestId: IDS.request,
        currentStatus: "ACTIVE",
        expectedSiteVersion: 1,
        managementCompanyId: IDS.company,
        reason: "Safety inspection",
        siteId: IDS.site,
        tenantId: IDS.tenant,
      }),
    ).resolves.toMatchObject({ requestId: IDS.request, siteId: IDS.site });
  });

  it("derives an approval queue and cancellation ownership without widening RLS", async () => {
    const own = pending({ id: "00000000-0000-4000-8000-000000000007", requestedBy: IDS.actor });
    const close = pending({ action: "CLOSE" });
    const service = new SiteLifecycleRequestService(repository([own, close]));

    const model = await service.list({ actor: actor("SUPER_ADMIN") });

    expect(model.approvalQueue).toEqual([close]);
    expect(model.cancellableRequestIds.has(own.id)).toBe(true);
    expect(model.pendingBySiteId.get(IDS.site)).toBe(close);
  });

  it("prevents a maker from reviewing its own request", async () => {
    const service = new SiteLifecycleRequestService(repository());

    await expect(
      service.approve({
        action: "SUSPEND",
        actor: actor("SUPER_ADMIN"),
        auditRequestId: IDS.request,
        expectedRequestVersion: 1,
        lifecycleRequestId: IDS.request,
        managementCompanyId: IDS.company,
        reason: "Reviewed and accepted",
        requestedBy: IDS.actor,
        siteId: IDS.site,
        tenantId: IDS.tenant,
      }),
    ).rejects.toEqual(new SiteLifecycleRequestError("SELF_REVIEW_FORBIDDEN"));
  });

  it("allows Platform Operator to review suspend but not close", async () => {
    const service = new SiteLifecycleRequestService(
      repository([pending(), pending({ action: "CLOSE" })]),
    );

    const model = await service.list({ actor: actor("PLATFORM_OPERATOR") });

    expect(model.approvalQueue.map((request) => request.action)).toEqual(["SUSPEND"]);
  });

  it("does not query or expose request reasons to non-participating Site readers", async () => {
    const repo = repository([pending()]);
    const service = new SiteLifecycleRequestService(repo);

    const model = await service.list({ actor: actor("SITE_OPERATOR") });

    expect(repo.listPending).not.toHaveBeenCalled();
    expect(model.pendingBySiteId.size).toBe(0);
  });

  it("allows only the original requester to cancel", async () => {
    const service = new SiteLifecycleRequestService(repository());

    await expect(
      service.cancel({
        action: "SUSPEND",
        actor: actor("MANAGEMENT_ADMIN"),
        auditRequestId: IDS.request,
        expectedRequestVersion: 1,
        lifecycleRequestId: IDS.request,
        managementCompanyId: IDS.company,
        reason: "No longer required",
        requestedBy: IDS.other,
        siteId: IDS.site,
        tenantId: IDS.tenant,
      }),
    ).rejects.toEqual(new SiteLifecycleRequestError("REQUESTER_REQUIRED"));
  });
});
