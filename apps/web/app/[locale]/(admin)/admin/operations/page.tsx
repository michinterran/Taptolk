import { QrOperationsReadModelService } from "@taptolk/application";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { loadOperationsWorkQueue } from "../../../../../admin/load-operations-work-queue";
import {
  readOperationsQueryValue,
  resolveOperationsRange,
  shiftOperationsDate,
} from "../../../../../admin/operations-range";
import { summarizeQrOperationsScope } from "../../../../../admin/qr-operations-scope-summary";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { OperationsDashboardView } from "../../../../../components/operations-dashboard-view";
import { getMessages } from "../../../../../content/messages";
import { OPERATIONS_COPY } from "../../../../../content/operations-copy";
import { isAppLocale } from "../../../../../i18n/locale";

function isOperationsUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    [
      "OPERATIONS_DASHBOARD_UNAVAILABLE",
      "OPERATIONS_WORK_QUEUE_UNAVAILABLE",
      "QR_OPERATIONS_UNAVAILABLE",
    ].includes(error.message)
  );
}

export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    compare?: string | string[];
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
  const range = resolveOperationsRange(query);
  const comparePrevious = readOperationsQueryValue(query.compare) === "previous";
  const requestedPage = Number.parseInt(readOperationsQueryValue(query.page) ?? "", 10);
  const requestedPageSize = Number.parseInt(readOperationsQueryValue(query.pageSize) ?? "", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = [10, 25, 50].includes(requestedPageSize) ? requestedPageSize : 10;
  const previousRange = {
    endDate: shiftOperationsDate(range.startDate, -1),
    startDate: shiftOperationsDate(range.startDate, -range.windowDays),
  };
  const currentScope = range.isExplicit
    ? {
        endDate: range.endDate,
        startDate: range.startDate,
      }
    : { days: range.windowDays };
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const copy = getMessages(locale);
  let model: Awaited<ReturnType<typeof loadOperationsDashboard>>;
  let qrOperationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  let comparisonModel: Awaited<ReturnType<typeof loadOperationsDashboard>>;
  let workQueue: Awaited<ReturnType<typeof loadOperationsWorkQueue>>;
  try {
    [model, qrOperationsModel, comparisonModel, workQueue] = await Promise.all([
      loadOperationsDashboard(context, {
        ...currentScope,
        ...(companyId ? { managementCompanyId: companyId } : {}),
        ...(siteId ? { siteId } : {}),
      }),
      new QrOperationsReadModelService(createSupabaseQrOperationsReadModelRepository(client)).read({
        actor: {
          authorization: toAdminAuthorizationContext(
            context.decision.membership,
            context.mfaLevel === "aal2",
          ),
          userId: context.userId,
        },
      }),
      comparePrevious
        ? loadOperationsDashboard(context, {
            endDate: previousRange.endDate,
            ...(companyId ? { managementCompanyId: companyId } : {}),
            ...(siteId ? { siteId } : {}),
            startDate: previousRange.startDate,
          })
        : Promise.resolve(null),
      loadOperationsWorkQueue(context, {
        ...(companyId ? { managementCompanyId: companyId } : {}),
        ...(siteId ? { siteId } : {}),
      }),
    ]);
  } catch (error) {
    if (!isOperationsUnavailable(error)) {
      throw error;
    }
    const operationsCopy = OPERATIONS_COPY[locale];
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
          pathname={`/${locale}/admin/operations`}
        />
        <div className="operations-shell">
          <PageHeader
            description={operationsCopy.description}
            eyebrow={operationsCopy.eyebrow}
            lines={[operationsCopy.line1]}
          />
          <section
            aria-labelledby="admin-operations-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-operations-unavailable-title">{operationsCopy.unavailableTitle}</h2>
            <p>{operationsCopy.unavailableDescription}</p>
            <a className="tt-button tt-button--secondary" href={`/${locale}/admin/operations`}>
              {copy["shared.error.retry"]}
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
        pathname={`/${locale}/admin/operations`}
      />
      <OperationsDashboardView
        comparePrevious={comparePrevious}
        {...(comparisonModel ? { comparisonModel } : {})}
        {...(companyId ? { companyId } : {})}
        copy={OPERATIONS_COPY[locale]}
        currentPage={page}
        endDate={range.endDate}
        locale={locale}
        model={model}
        pageSize={pageSize}
        qrOperations={summarizeQrOperationsScope(qrOperationsModel, {
          ...(companyId ? { managementCompanyId: companyId } : {}),
          ...(siteId ? { siteId } : {}),
        })}
        {...(siteId ? { siteId } : {})}
        startDate={range.startDate}
        workQueue={workQueue}
      />
    </main>
  );
}
