import { TenantCatalogService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { createSupabaseTenantCatalogRepository } from "../../../../../admin/supabase-tenant-catalog-repository";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { TenantCatalogView } from "../../../../../components/tenant-catalog-view";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

function readPage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function PlatformTenantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  if (getAdminLandingArea(context.decision.membership.role) !== "platform") {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }

  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }

  const { membership } = context.decision;
  const service = new TenantCatalogService(createSupabaseTenantCatalogRepository(client));
  const catalog = await service.list({
    actor: {
      mfaVerified: context.mfaLevel === "aal2",
      role: membership.role,
      scope: { type: "PLATFORM" },
    },
    page: readPage(query.page),
  });
  const copy = getMessages(locale);

  return (
    <main className="admin-dashboard-shell">
      <TenantCatalogView
        catalog={catalog}
        copy={{
          back: copy["admin.tenants.back"],
          createdAt: copy["admin.tenants.createdAt"],
          description: copy["admin.tenants.description"],
          emptyDescription: copy["admin.tenants.empty.description"],
          emptyTitle: copy["admin.tenants.empty.title"],
          eyebrow: copy["admin.tenants.eyebrow"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          name: copy["admin.tenants.name"],
          next: copy["admin.tenants.next"],
          page: copy["admin.tenants.page"],
          paginationLabel: copy["admin.tenants.pagination"],
          previous: copy["admin.tenants.previous"],
          securityNote: copy["admin.tenants.securityNote"],
          signOut: copy["admin.shared.signOut"],
          slug: copy["admin.tenants.slug"],
          status: copy["admin.tenants.status"],
          statusLabels: {
            ACTIVE: copy["admin.tenants.status.active"],
            CLOSED: copy["admin.tenants.status.closed"],
            SUSPENDED: copy["admin.tenants.status.suspended"],
          },
          titleLines: [copy["admin.tenants.line1"], copy["admin.tenants.line2"]],
          total: copy["admin.tenants.total"],
        }}
        locale={locale}
      />
    </main>
  );
}
