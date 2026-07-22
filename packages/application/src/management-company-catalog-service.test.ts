import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import {
  type ManagementCompanyCatalogRepository,
  ManagementCompanyCatalogService,
} from "./management-company-catalog-service.js";

function createRepository(): ManagementCompanyCatalogRepository {
  return {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listActiveTenants: vi.fn(async () => []),
  };
}

describe("Management company catalog service", () => {
  it("keeps the normalized search and status filter across a deterministic page", async () => {
    const repository = createRepository();
    const service = new ManagementCompanyCatalogService(repository);

    await service.list({
      actor: {
        mfaVerified: true,
        role: "SUPER_ADMIN",
        scope: { type: "PLATFORM" },
      },
      page: 2,
      search: "  Acme  ",
      status: "SUSPENDED",
    });

    expect(repository.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 20,
      search: "Acme",
      status: "SUSPENDED",
    });
  });

  it("rejects tenant-scoped actors before repository access", async () => {
    const repository = createRepository();
    const service = new ManagementCompanyCatalogService(repository);

    await expect(
      service.list({
        actor: {
          mfaVerified: true,
          role: "READ_ONLY",
          scope: { tenantId: "tenant-a", type: "TENANT" },
        },
      }),
    ).rejects.toEqual(new AdminAuthorizationError("OUT_OF_SCOPE"));

    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.listActiveTenants).not.toHaveBeenCalled();
  });
});
