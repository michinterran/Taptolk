import {
  ManagementCompanyWorkspaceService,
  QrOperationsReadModelService,
} from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { summarizeQrOperationsScope } from "../../../../../../../admin/qr-operations-scope-summary";
import { createSupabaseManagementCompanyWorkspaceRepository } from "../../../../../../../admin/supabase-management-company-workspace-repository";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../../../components/admin-page-header";
import { ManagementCompanyWorkspaceView } from "../../../../../../../components/management-company-workspace-view";
import { ADMIN_COMPANY_WORKSPACE_COPY } from "../../../../../../../content/admin-company-workspace-copy";
import { getMessages } from "../../../../../../../content/messages";
import { isAppLocale } from "../../../../../../../i18n/locale";

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

function isManagementCompanyWorkspaceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message === "MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE" ||
    error.message === "QR_OPERATIONS_UNAVAILABLE"
  );
}

export default async function ManagementCompanyWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
    status?: string | string[];
  }>;
}) {
  const { companyId, locale } = await params;
  const query = await searchParams;
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  if (getAdminLandingArea(context.decision.membership.role) !== "platform") {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }
  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  const membership = context.decision.membership;
  let model: Awaited<ReturnType<ManagementCompanyWorkspaceService["read"]>>;
  let qrOperationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  try {
    [model, qrOperationsModel] = await Promise.all([
      new ManagementCompanyWorkspaceService(
        createSupabaseManagementCompanyWorkspaceRepository(client),
      ).read({
        actor: {
          mfaVerified: context.mfaLevel === "aal2",
          role: membership.role,
          scope: { type: "PLATFORM" },
        },
        companyId,
      }),
      new QrOperationsReadModelService(createSupabaseQrOperationsReadModelRepository(client)).read({
        actor: {
          authorization: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
          userId: context.userId,
        },
      }),
    ]);
  } catch (error) {
    if (!isManagementCompanyWorkspaceUnavailable(error)) {
      throw error;
    }
    const messages = getMessages(locale);
    const copy = ADMIN_COMPANY_WORKSPACE_COPY[locale];
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: messages["locale.english"],
            ko: messages["locale.korean"],
          }}
          localeTitle={messages["locale.switcher.label"]}
          logoAlt={messages["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/platform/management-companies/${companyId}`}
        />
        <div className="admin-workspace-canvas">
          <a className="admin-inline-back" href={`/${locale}/admin/platform/management-companies`}>
            {copy.allCompanies}
          </a>
          <PageHeader
            className="admin-compact-heading admin-compact-heading--workspace"
            description={copy.workspaceDescription}
            eyebrow={copy.companyWorkspace}
            lines={[copy.companyWorkspace]}
          />
          <section
            aria-labelledby="admin-company-workspace-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-company-workspace-unavailable-title">
              {messages["admin.companies.error.unavailable"]}
            </h2>
            <p>{messages["shared.error.description"]}</p>
            <a
              className="tt-button tt-button--secondary"
              href={`/${locale}/admin/platform/management-companies/${companyId}`}
            >
              {messages["shared.error.retry"]}
            </a>
          </section>
        </div>
      </main>
    );
  }
  if (!model) notFound();
  const messages = getMessages(locale);
  const page = readPositiveInt(query.page, 1);
  const pageSize = readPageSize(query.pageSize);
  const siteSearch = readValue(query.q);
  const statusMessage =
    readValue(query.status) === "created"
      ? messages["admin.companies.status.created"]
      : readValue(query.status) === "updated"
        ? messages["admin.companies.status.updated"]
        : readValue(query.status) === "statusChanged"
          ? messages["admin.companies.status.statusChanged"]
          : undefined;
  const errorMessage =
    readValue(query.error) === "blocked"
      ? messages["admin.companies.error.blocked"]
      : readValue(query.error) === "conflict"
        ? messages["admin.companies.error.conflict"]
        : readValue(query.error) === "forbidden"
          ? messages["admin.companies.error.forbidden"]
          : readValue(query.error) === "validation"
            ? messages["admin.companies.error.validation"]
            : readValue(query.error) === "unavailable"
              ? messages["admin.companies.error.unavailable"]
              : undefined;
  return (
    <main className="admin-dashboard-shell">
      <ManagementCompanyWorkspaceView
        canManage={
          roleHasPermission(membership.role, "management-company:update") &&
          roleHasPermission(membership.role, "management-company:suspend") &&
          roleHasPermission(membership.role, "management-company:close")
        }
        copy={ADMIN_COMPANY_WORKSPACE_COPY[locale]}
        errorMessage={errorMessage}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
        page={page}
        pageSize={pageSize}
        qrOperations={summarizeQrOperationsScope(qrOperationsModel, {
          managementCompanyId: companyId,
        })}
        {...(siteSearch ? { siteSearch } : {})}
        siteTypeLabels={{
          APARTMENT: messages["admin.sites.type.apartment"],
          BUILDING: messages["admin.sites.type.building"],
          OFFICETEL: messages["admin.sites.type.officetel"],
          OTHER: messages["admin.sites.type.other"],
        }}
        statusMessage={statusMessage}
        statusLabels={{
          ACTIVE: messages["admin.companies.status.active"],
          CLOSED: messages["admin.companies.status.closed"],
          SUSPENDED: messages["admin.companies.status.suspended"],
        }}
      />
    </main>
  );
}
