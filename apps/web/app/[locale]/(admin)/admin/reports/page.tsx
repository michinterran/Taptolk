import { QrOperationsReadModelService } from "@taptolk/application";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import {
  readOperationsQueryValue,
  resolveOperationsRange,
} from "../../../../../admin/operations-range";
import { summarizeQrOperationsScope } from "../../../../../admin/qr-operations-scope-summary";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminAnalyticsView } from "../../../../../components/admin-analytics-view";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { ADMIN_ANALYTICS_COPY } from "../../../../../content/admin-analytics-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

const REPORT_PAGE_SIZES = [10, 25, 50] as const;

function readPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = candidate ? Number.parseInt(candidate, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readReportPageSize(value: string | string[] | undefined): number {
  const parsed = readPositiveInt(value, 10);
  return REPORT_PAGE_SIZES.includes(parsed as (typeof REPORT_PAGE_SIZES)[number]) ? parsed : 10;
}

function isOperationsDashboardUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    ["OPERATIONS_DASHBOARD_UNAVAILABLE", "QR_OPERATIONS_UNAVAILABLE"].includes(error.message)
  );
}

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    days?: string | string[];
    end?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    site?: string | string[];
    start?: string | string[];
  }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const query = await searchParams;
  const companyId = readOperationsQueryValue(query.company);
  const siteId = readOperationsQueryValue(query.site);
  const page = readPositiveInt(query.page, 1);
  const pageSize = readReportPageSize(query.pageSize);
  const range = resolveOperationsRange(query);
  const currentScope = range.isExplicit
    ? { endDate: range.endDate, startDate: range.startDate }
    : { days: range.windowDays };
  const reportScope = new URLSearchParams();
  if (companyId) reportScope.set("company", companyId);
  if (siteId) reportScope.set("site", siteId);
  if (range.isExplicit) {
    reportScope.set("start", range.startDate);
    reportScope.set("end", range.endDate);
  } else {
    reportScope.set("days", String(range.windowDays));
  }
  if (page > 1) reportScope.set("page", String(page));
  if (pageSize !== 10) reportScope.set("pageSize", String(pageSize));
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const copy = getMessages(locale);
  let model: Awaited<ReturnType<typeof loadOperationsDashboard>>;
  try {
    model = await loadOperationsDashboard(context, {
      ...currentScope,
      ...(companyId ? { managementCompanyId: companyId } : {}),
      ...(siteId ? { siteId } : {}),
    });
  } catch (error) {
    if (!isOperationsDashboardUnavailable(error)) {
      throw error;
    }
    const analyticsCopy = ADMIN_ANALYTICS_COPY[locale];
    const retryHref = `/${locale}/admin/reports${reportScope.toString() ? `?${reportScope.toString()}` : ""}`;
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          }}
          localeTitle={copy["locale.switcher.label"]}
          logoAlt={copy["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/reports`}
        />
        <div className="operations-shell admin-report-shell">
          <PageHeader
            description={analyticsCopy.description}
            eyebrow={analyticsCopy.eyebrow}
            lines={[analyticsCopy.line1]}
          />
          <section
            aria-labelledby="admin-report-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-report-unavailable-title">{analyticsCopy.unavailableTitle}</h2>
            <p>{analyticsCopy.unavailableDescription}</p>
            <a className="tt-button tt-button--secondary" href={retryHref}>
              {analyticsCopy.retry}
            </a>
          </section>
        </div>
      </main>
    );
  }
  let qrOperationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  try {
    qrOperationsModel = await new QrOperationsReadModelService(
      createSupabaseQrOperationsReadModelRepository(client),
    ).read({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
    });
  } catch (error) {
    if (!isOperationsDashboardUnavailable(error)) {
      throw error;
    }
    const analyticsCopy = ADMIN_ANALYTICS_COPY[locale];
    const retryHref = `/${locale}/admin/reports${reportScope.toString() ? `?${reportScope.toString()}` : ""}`;
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          }}
          localeTitle={copy["locale.switcher.label"]}
          logoAlt={copy["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/reports`}
        />
        <div className="operations-shell admin-report-shell">
          <PageHeader
            description={analyticsCopy.description}
            eyebrow={analyticsCopy.eyebrow}
            lines={[analyticsCopy.line1]}
          />
          <section
            aria-labelledby="admin-report-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-report-unavailable-title">{analyticsCopy.unavailableTitle}</h2>
            <p>{analyticsCopy.unavailableDescription}</p>
            <a className="tt-button tt-button--secondary" href={retryHref}>
              {analyticsCopy.retry}
            </a>
          </section>
        </div>
      </main>
    );
  }
  if (!model) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }

  return (
    <main className="admin-dashboard-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/reports`}
      />
      <AdminAnalyticsView
        backHref={`/${locale}/admin/operations?${reportScope.toString()}`}
        copy={ADMIN_ANALYTICS_COPY[locale]}
        {...(companyId ? { companyId } : {})}
        endDate={range.endDate}
        isExplicitRange={range.isExplicit}
        locale={locale}
        model={model}
        page={page}
        pageSize={pageSize}
        qrOperations={summarizeQrOperationsScope(qrOperationsModel, {
          ...(companyId ? { managementCompanyId: companyId } : {}),
          ...(siteId ? { siteId } : {}),
        })}
        {...(siteId ? { siteId } : {})}
        startDate={range.startDate}
      />
    </main>
  );
}
