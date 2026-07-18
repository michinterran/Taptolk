import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import { SiteApplicationService, type SiteRecord, type SiteUnitOfWork } from "./site-service.js";

const site: SiteRecord = {
  contractVehicleLimit: 100,
  id: "site-a",
  managementCompanyId: "company-a",
  name: "Taptolk Site",
  status: "ACTIVE",
  tenantId: "tenant-a",
  type: "APARTMENT",
  version: 1,
};

function createUnitOfWork(): SiteUnitOfWork {
  return {
    appendAudit: vi.fn(async () => undefined),
    archiveSite: vi.fn(async (current) => ({
      ...current,
      status: "CLOSED",
      version: current.version + 1,
    })),
    createSite: vi.fn(async () => site),
    updateSite: vi.fn(async (current, changes) => ({
      ...current,
      ...changes,
      version: current.version + 1,
    })),
  };
}

describe("Site application service", () => {
  it("writes the Site and audit event in one transaction", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new SiteApplicationService({
      execute: async (operation) => operation(unitOfWork),
    });

    const created = await service.create({
      actor: {
        mfaVerified: true,
        role: "SUPER_ADMIN",
        scope: {
          type: "PLATFORM",
        },
      },
      actorId: "admin-a",
      contractVehicleLimit: 100,
      managementCompanyId: "company-a",
      name: " Taptolk Site ",
      requestId: "request-a",
      tenantId: "tenant-a",
      type: "APARTMENT",
    });

    expect(created).toEqual(site);
    expect(unitOfWork.createSite).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Taptolk Site" }),
    );
    expect(unitOfWork.appendAudit).toHaveBeenCalledOnce();
  });

  it("blocks direct creation by a Management Admin before repository access", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new SiteApplicationService({
      execute: async (operation) => operation(unitOfWork),
    });

    await expect(
      service.create({
        actor: {
          mfaVerified: true,
          role: "MANAGEMENT_ADMIN",
          scope: {
            managementCompanyId: "company-b",
            tenantId: "tenant-b",
            type: "MANAGEMENT_COMPANY",
          },
        },
        actorId: "admin-b",
        contractVehicleLimit: 100,
        managementCompanyId: "company-a",
        name: "Forbidden Site",
        requestId: "request-b",
        tenantId: "tenant-a",
        type: "APARTMENT",
      }),
    ).rejects.toEqual(new AdminAuthorizationError("ROLE_FORBIDDEN"));

    expect(unitOfWork.createSite).not.toHaveBeenCalled();
  });

  it("blocks a cross-tenant operational update before repository access", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new SiteApplicationService({
      execute: async (operation) => operation(unitOfWork),
    });

    await expect(
      service.update({
        actor: {
          mfaVerified: true,
          role: "MANAGEMENT_ADMIN",
          scope: {
            managementCompanyId: "company-b",
            tenantId: "tenant-b",
            type: "MANAGEMENT_COMPANY",
          },
        },
        actorId: "admin-b",
        expectedVersion: 1,
        name: "Forbidden Site",
        requestId: "request-c",
        site,
      }),
    ).rejects.toEqual(new AdminAuthorizationError("OUT_OF_SCOPE"));

    expect(unitOfWork.updateSite).not.toHaveBeenCalled();
  });
});
