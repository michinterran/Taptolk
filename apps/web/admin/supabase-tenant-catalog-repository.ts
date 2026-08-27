import "server-only";

import type {
  TenantCatalogItem,
  TenantCatalogRepository,
  TenantStatus,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

interface TenantCatalogRow {
  created_at: string;
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  version: number;
}

const logger = createLogger({ service: "taptolk-web" });

function isTenantStatus(value: unknown): value is TenantStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

function mapTenantRow(row: unknown): TenantCatalogItem {
  if (!row || typeof row !== "object") {
    throw new Error("Tenant catalog returned an invalid row.");
  }

  const candidate = row as Partial<TenantCatalogRow>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.slug !== "string" ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.version !== "number" ||
    !isTenantStatus(candidate.status)
  ) {
    throw new Error("Tenant catalog returned an invalid row shape.");
  }

  return {
    createdAt: candidate.created_at,
    id: candidate.id,
    name: candidate.name,
    slug: candidate.slug,
    status: candidate.status,
    version: candidate.version,
  };
}

export function createSupabaseTenantCatalogRepository(
  client: AdminServerClient,
): TenantCatalogRepository {
  return {
    async list({ limit, offset }) {
      const result = await client
        .from("tenants")
        .select("id, name, slug, status, version, created_at", {
          count: "exact",
        })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);

      if (result.error) {
        logger.error("admin.tenant_catalog.query_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load the tenant catalog.");
      }

      return {
        items: (result.data ?? []).map((row) => mapTenantRow(row)),
        total: result.count ?? 0,
      };
    },
  };
}
