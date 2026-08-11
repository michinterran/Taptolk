import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import { type SiteCatalogRepository, SiteCatalogService } from "./site-catalog-service.js";

const actor: AdminAuthorizationContext = {
  mfaVerified: true,
  role: "SUPER_ADMIN",
  scope: { type: "PLATFORM" },
};

function createRepository(): SiteCatalogRepository {
  return {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    listActiveParents: vi.fn(async () => []),
  };
}

describe("SiteCatalogService", () => {
  it("normalizes the catalog query before the repository call", async () => {
    const repository = createRepository();
    const service = new SiteCatalogService(repository);

    await service.list({
      actor,
      query: {
        createdFrom: "2026-08-01",
        createdTo: "2026-08-12",
        direction: "asc",
        managementCompanyId: "11111111-1111-4111-8111-111111111111",
        page: 2,
        pageSize: 10,
        search: "  Riverside  ",
        siteType: "OFFICETEL",
        sort: "name",
        status: "ACTIVE",
      },
    });

    expect(repository.list).toHaveBeenCalledWith({
      createdFrom: "2026-08-01",
      createdTo: "2026-08-12",
      direction: "asc",
      limit: 10,
      managementCompanyId: "11111111-1111-4111-8111-111111111111",
      offset: 10,
      search: "Riverside",
      siteType: "OFFICETEL",
      sort: "name",
      status: "ACTIVE",
    });
  });

  it("keeps safe defaults for invalid query values", async () => {
    const repository = createRepository();
    const service = new SiteCatalogService(repository);

    const page = await service.list({
      actor,
      query: {
        createdFrom: "2026-08-12",
        createdTo: "2026-08-01",
        direction: "sideways" as "asc",
        managementCompanyId: "not-a-uuid",
        page: 0,
        pageSize: 99,
        search: " ".repeat(101),
        siteType: "UNKNOWN" as "APARTMENT",
        sort: "unknown" as "createdAt",
        status: "UNKNOWN" as "ACTIVE",
      },
    });

    expect(repository.list).toHaveBeenCalledWith({
      direction: "desc",
      limit: 20,
      offset: 0,
      sort: "createdAt",
    });
    expect(page.query).toEqual({
      direction: "desc",
      pageSize: 20,
      sort: "createdAt",
    });
  });

  it("uses the read scope to load filter options for read-only operators", async () => {
    const repository = createRepository();
    const service = new SiteCatalogService(repository);

    await service.list({
      actor: { ...actor, role: "READ_ONLY" },
    });

    expect(repository.listActiveParents).toHaveBeenCalledTimes(1);
  });
});
