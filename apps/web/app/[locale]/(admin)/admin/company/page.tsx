import {
  ManagementCompanyWorkspaceService,
  QrOperationsReadModelService,
} from "@taptolk/application";
import { notFound, redirect } from "next/navigation";
import { summarizeQrOperationsScope } from "../../../../../admin/qr-operations-scope-summary";
import { createSupabaseManagementCompanyWorkspaceRepository } from "../../../../../admin/supabase-management-company-workspace-repository";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getAdminConsoleArea, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { ManagementCompanyWorkspaceView } from "../../../../../components/management-company-workspace-view";
import { ADMIN_COMPANY_WORKSPACE_COPY } from "../../../../../content/admin-company-workspace-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number(readValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readPageSize(value: string | string[] | undefined): number {
  const parsed = readPositiveInt(value, 10);
  return parsed === 20 || parsed === 50 ? parsed : 10;
}

export default async function ManagementCompanyConsolePage({
  searchParams,
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isAppLocale(locale)) notFound();

  const context = await requireReadyAdminContext(locale);
  if (getAdminConsoleArea(context.decision.membership) !== "company") {
    redirect(
      getLocalizedAdminPath(
        locale,
        getAdminConsoleArea(context.decision.membership) === "platform"
          ? "/platform"
          : "/dashboard",
      ),
    );
  }

  const membership = context.decision.membership;
  if (!membership.managementCompanyId) {
    redirect(getLocalizedAdminPath(locale, "/access?error=scope"));
  }

  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));

  const authorization = toAdminAuthorizationContext(membership, context.mfaLevel === "aal2");
  const [model, qrOperationsModel] = await Promise.all([
    new ManagementCompanyWorkspaceService(
      createSupabaseManagementCompanyWorkspaceRepository(client),
    ).read({ actor: authorization, companyId: membership.managementCompanyId }),
    new QrOperationsReadModelService(createSupabaseQrOperationsReadModelRepository(client)).read({
      actor: {
        authorization,
        userId: context.userId,
      },
    }),
  ]);
  if (!model) notFound();

  const messages = getMessages(locale);
  const workspaceBasePath = `/${locale}/admin/company`;
  const page = readPositiveInt(query.page, 1);
  const pageSize = readPageSize(query.pageSize);
  const siteSearch = readValue(query.q);

  return (
    <main className="admin-dashboard-shell">
      <ManagementCompanyWorkspaceView
        accessHref={`/${locale}/admin/accounts`}
        canManage={false}
        copy={ADMIN_COMPANY_WORKSPACE_COPY[locale]}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
        page={page}
        pageSize={pageSize}
        qrOperations={summarizeQrOperationsScope(qrOperationsModel, {
          managementCompanyId: membership.managementCompanyId,
        })}
        {...(siteSearch ? { siteSearch } : {})}
        showBackLink={false}
        siteTypeLabels={{
          APARTMENT: messages["admin.sites.type.apartment"],
          BUILDING: messages["admin.sites.type.building"],
          OFFICETEL: messages["admin.sites.type.officetel"],
          OTHER: messages["admin.sites.type.other"],
        }}
        statusLabels={{
          ACTIVE: messages["admin.companies.status.active"],
          CLOSED: messages["admin.companies.status.closed"],
          SUSPENDED: messages["admin.companies.status.suspended"],
        }}
        workspaceBasePath={workspaceBasePath}
      />
    </main>
  );
}
