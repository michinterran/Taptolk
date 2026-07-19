import { TenantCatalogService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
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

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformTenantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    status?: string | string[];
  }>;
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
  const error = readValue(query.error);
  const status = readValue(query.status);
  const errorMessages: Readonly<Record<string, string>> = {
    conflict: copy["admin.tenants.error.conflict"],
    forbidden: copy["admin.tenants.error.forbidden"],
    unavailable: copy["admin.tenants.error.unavailable"],
    validation: copy["admin.tenants.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    created: copy["admin.tenants.status.created"],
    statusChanged: copy["admin.tenants.status.statusChanged"],
    updated: copy["admin.tenants.status.updated"],
  };

  return (
    <main className="admin-dashboard-shell">
      <TenantCatalogView
        canManage={roleHasPermission(membership.role, "tenant:create")}
        catalog={catalog}
        copy={{
          actions: copy["admin.tenants.actions"],
          back: copy["admin.tenants.back"],
          close: copy["admin.tenants.close"],
          create: copy["admin.tenants.create"],
          createDescription: copy["admin.tenants.create.description"],
          createTitle: copy["admin.tenants.create.title"],
          createdAt: copy["admin.tenants.createdAt"],
          description: copy["admin.tenants.description"],
          edit: copy["admin.tenants.edit"],
          editDescription: copy["admin.tenants.edit.description"],
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
          reactivate: copy["admin.tenants.reactivate"],
          readOnly: copy["admin.tenants.readOnly"],
          reason: copy["admin.tenants.reason"],
          reasonPlaceholder: copy["admin.tenants.reason.placeholder"],
          save: copy["admin.tenants.save"],
          securityNote: copy["admin.tenants.securityNote"],
          signOut: copy["admin.shared.signOut"],
          slug: copy["admin.tenants.slug"],
          slugHelp: copy["admin.tenants.slug.help"],
          status: copy["admin.tenants.status"],
          statusDescription: copy["admin.tenants.status.description"],
          statusLabels: {
            ACTIVE: copy["admin.tenants.status.active"],
            CLOSED: copy["admin.tenants.status.closed"],
            SUSPENDED: copy["admin.tenants.status.suspended"],
          },
          suspend: copy["admin.tenants.suspend"],
          titleLines: [copy["admin.tenants.line1"], copy["admin.tenants.line2"]],
          total: copy["admin.tenants.total"],
        }}
        errorMessage={error ? errorMessages[error] : undefined}
        locale={locale}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
