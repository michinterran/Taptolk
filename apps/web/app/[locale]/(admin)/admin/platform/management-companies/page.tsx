import { ManagementCompanyCatalogService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createSupabaseManagementCompanyCatalogRepository } from "../../../../../../admin/supabase-management-company-catalog-repository";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { ManagementCompanyCatalogView } from "../../../../../../components/management-company-catalog-view";
import { ADMIN_COMPANY_PORTFOLIO_COPY } from "../../../../../../content/admin-company-portfolio-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number(readValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ManagementCompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    q?: string | string[];
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

  const membership = context.decision.membership;
  const search = readValue(query.q);
  const catalog = await new ManagementCompanyCatalogService(
    createSupabaseManagementCompanyCatalogRepository(client),
  ).list({
    actor: {
      mfaVerified: context.mfaLevel === "aal2",
      role: membership.role,
      scope: { type: "PLATFORM" },
    },
    page: readPage(query.page),
    ...(search ? { search } : {}),
  });
  const copy = getMessages(locale);
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: copy["admin.companies.error.blocked"],
    conflict: copy["admin.companies.error.conflict"],
    forbidden: copy["admin.companies.error.forbidden"],
    unavailable: copy["admin.companies.error.unavailable"],
    validation: copy["admin.companies.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    created: copy["admin.companies.status.created"],
    statusChanged: copy["admin.companies.status.statusChanged"],
    updated: copy["admin.companies.status.updated"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);

  return (
    <main className="admin-dashboard-shell">
      <ManagementCompanyCatalogView
        canManage={roleHasPermission(membership.role, "management-company:create")}
        catalog={catalog}
        copy={{
          actions: copy["admin.companies.actions"],
          back: copy["admin.companies.back"],
          businessNumber: copy["admin.companies.businessNumber"],
          businessNumberHelp: copy["admin.companies.businessNumber.help"],
          close: copy["admin.companies.close"],
          create: copy["admin.companies.create"],
          createDescription: copy["admin.companies.create.description"],
          createTitle: copy["admin.companies.create.title"],
          createdAt: copy["admin.companies.createdAt"],
          description: copy["admin.companies.description"],
          edit: copy["admin.companies.edit"],
          editDescription: copy["admin.companies.edit.description"],
          emptyDescription: copy["admin.companies.empty.description"],
          emptyTitle: copy["admin.companies.empty.title"],
          eyebrow: copy["admin.companies.eyebrow"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          name: copy["admin.companies.name"],
          next: copy["admin.companies.next"],
          noActiveTenant: copy["admin.companies.noActiveTenant"],
          page: copy["admin.companies.page"],
          paginationLabel: copy["admin.companies.pagination"],
          previous: copy["admin.companies.previous"],
          reactivate: copy["admin.companies.reactivate"],
          readOnly: copy["admin.companies.readOnly"],
          reason: copy["admin.companies.reason"],
          reasonPlaceholder: copy["admin.companies.reason.placeholder"],
          save: copy["admin.companies.save"],
          securityNote: copy["admin.companies.securityNote"],
          status: copy["admin.companies.status"],
          statusDescription: copy["admin.companies.status.description"],
          statusLabels: {
            ACTIVE: copy["admin.companies.status.active"],
            CLOSED: copy["admin.companies.status.closed"],
            SUSPENDED: copy["admin.companies.status.suspended"],
          },
          suspend: copy["admin.companies.suspend"],
          tenant: copy["admin.companies.tenant"],
          total: copy["admin.companies.total"],
        }}
        errorMessage={error ? errorMessages[error] : undefined}
        locale={locale}
        portfolioCopy={ADMIN_COMPANY_PORTFOLIO_COPY[locale]}
        search={search}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
