import {
  ArrowLeft,
  BellRinging,
  CalendarBlank,
  CaretRight,
  ChartLine,
  QrCode,
  ShieldWarning,
} from "@phosphor-icons/react/dist/ssr";
import type { OperationsDailyPoint, OperationsDashboardModel } from "@taptolk/application";
import { DataTable, PageHeader, Pagination, StatStrip, StatTile } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { OPERATIONS_PERIOD_DAYS } from "../admin/operations-range";
import type { QrOperationsScopeSummary } from "../admin/qr-operations-scope-summary";
import type { AdminAnalyticsCopy } from "../content/admin-analytics-copy";
import type { AppLocale } from "../i18n/config";
import { ConsoleQueryForm } from "./console-query-form";

const EMPTY_VALUE = "—";

function reportQuery(
  locale: AppLocale,
  params: {
    companyId?: string | undefined;
    days?: number | undefined;
    endDate?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    siteId?: string | undefined;
    startDate?: string | undefined;
  },
): Route {
  const query = new URLSearchParams();
  if (params.companyId) query.set("company", params.companyId);
  if (params.siteId) query.set("site", params.siteId);
  if (params.days) query.set("days", String(params.days));
  if (params.startDate) query.set("start", params.startDate);
  if (params.endDate) query.set("end", params.endDate);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 10) query.set("pageSize", String(params.pageSize));
  const value = query.toString();
  return `/${locale}/admin/reports${value ? `?${value}` : ""}` as Route;
}

/** Null when there is no basis to divide by, so a scope with no activity reads as
    "no data" instead of a perfect score. */
function percent(part: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function AdminAnalyticsView({
  backHref,
  copy,
  endDate,
  isExplicitRange,
  locale,
  model,
  page,
  pageSize,
  qrOperations,
  siteId,
  startDate,
  companyId,
}: {
  backHref: string;
  copy: AdminAnalyticsCopy;
  companyId?: string;
  endDate: string;
  isExplicitRange: boolean;
  locale: AppLocale;
  model: OperationsDashboardModel;
  page: number;
  pageSize: number;
  qrOperations: QrOperationsScopeSummary;
  siteId?: string;
  startDate: string;
}) {
  const number = new Intl.NumberFormat(locale);
  const contactTotal = model.contactCount;
  const deliveryTotal =
    model.notificationSentCount + model.notificationFailedCount + model.notificationRetryCount;
  const unresolvedRate = percent(model.unresolvedCount, contactTotal);
  const resolutionRate = unresolvedRate === null ? null : 100 - unresolvedRate;
  const deliveryRate = percent(model.notificationSentCount, deliveryTotal);
  const escalationRate = percent(model.escalatedCount, contactTotal);
  const scopeLabel = model.scopeSiteName ?? model.scopeManagementCompanyName ?? copy.scopeAll;
  const totalDailyPages = Math.max(1, Math.ceil(model.dailySeries.length / pageSize));
  const currentDailyPage = Math.min(Math.max(page, 1), totalDailyPages);
  const dailyRows = model.dailySeries.slice(
    (currentDailyPage - 1) * pageSize,
    currentDailyPage * pageSize,
  );
  const dailyPageSummary = copy.page
    .replace("{current}", String(currentDailyPage))
    .replace("{total}", String(totalDailyPages));
  const dailyColumns = [
    {
      cell: (point: OperationsDailyPoint) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          new Date(`${point.date}T00:00:00Z`),
        ),
      header: copy.date,
      key: "date",
    },
    {
      align: "right" as const,
      cell: (point: OperationsDailyPoint) => number.format(point.contactCount),
      header: copy.contactCount,
      key: "contacts",
    },
    {
      align: "right" as const,
      cell: (point: OperationsDailyPoint) => number.format(point.unresolvedCount),
      header: copy.unresolved,
      key: "unresolved",
    },
    {
      align: "right" as const,
      cell: (point: OperationsDailyPoint) => number.format(point.escalatedCount),
      header: copy.escalated,
      key: "escalated",
    },
    {
      align: "right" as const,
      cell: (point: OperationsDailyPoint) => number.format(point.notificationSentCount),
      header: copy.sent,
      key: "sent",
    },
    {
      align: "right" as const,
      cell: (point: OperationsDailyPoint) => number.format(point.notificationFailedCount),
      header: copy.failed,
      key: "failed",
    },
  ];

  return (
    <div className="operations-shell admin-report-shell">
      <PageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={[copy.line1]}
        actions={
          <>
            <a className="operations-back operations-back--compact" href={backHref}>
              <ArrowLeft aria-hidden="true" size={15} /> {copy.back}
            </a>
            <dl className="operations-scope-summary">
              <div>
                <dt>{copy.scope}</dt>
                <dd>{scopeLabel}</dd>
              </div>
              <div>
                <dt>{copy.freshAt}</dt>
                <dd>
                  <time dateTime={model.freshAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(model.freshAt))}
                  </time>
                </dd>
              </div>
            </dl>
          </>
        }
      />

      <section
        className="operations-period-controls admin-report-period-controls"
        aria-label={copy.period}
      >
        <nav className="tt-console-tabs operations-period-tabs" aria-label={copy.period}>
          {OPERATIONS_PERIOD_DAYS.map((days) => (
            <Link
              aria-current={!isExplicitRange && model.windowDays === days ? "page" : undefined}
              href={reportQuery(locale, { companyId, days, pageSize, siteId })}
              key={days}
            >
              {days === 1 ? copy.periodToday : `${days}${copy.days}`}
            </Link>
          ))}
        </nav>

        <div className="operations-custom-range">
          <span className="operations-period-custom-label">
            <CalendarBlank aria-hidden="true" size={15} />
            {copy.periodCustom}
          </span>
          <ConsoleQueryForm className="operations-date-range">
            <input aria-label={copy.scope} name="company" type="hidden" value={companyId ?? ""} />
            <input aria-label={copy.scope} name="site" type="hidden" value={siteId ?? ""} />
            <label>
              <span className="sr-only">{copy.startDate}</span>
              <input
                aria-label={copy.startDate}
                defaultValue={startDate}
                name="start"
                type="date"
              />
            </label>
            <span className="operations-date-range__separator" aria-hidden="true">
              <CaretRight size={14} />
            </span>
            <label>
              <span className="sr-only">{copy.endDate}</span>
              <input aria-label={copy.endDate} defaultValue={endDate} name="end" type="date" />
            </label>
            <button className="tt-button tt-button--secondary tt-button--compact" type="submit">
              {copy.apply}
            </button>
          </ConsoleQueryForm>
        </div>
      </section>

      <section className="console-analytics-frame admin-report-grid">
        <StatStrip columns={4} aria-label={copy.responseQuality}>
          <StatTile
            icon={<ChartLine aria-hidden="true" size={22} />}
            label={copy.resolutionRate}
            value={resolutionRate === null ? EMPTY_VALUE : `${resolutionRate}%`}
          />
          <StatTile
            icon={<BellRinging aria-hidden="true" size={22} />}
            label={copy.deliveryRate}
            value={deliveryRate === null ? EMPTY_VALUE : `${deliveryRate}%`}
          />
          <StatTile
            icon={<ShieldWarning aria-hidden="true" size={22} />}
            label={copy.escalationRate}
            {...(escalationRate !== null && escalationRate > 0
              ? ({ tone: "warning" } as const)
              : {})}
            value={escalationRate === null ? EMPTY_VALUE : `${escalationRate}%`}
          />
          <StatTile
            icon={<QrCode aria-hidden="true" size={22} />}
            label={copy.activeQr}
            value={number.format(qrOperations.activeQr)}
          />
        </StatStrip>
        <article className="admin-report-section" id="response-quality">
          <header>
            <h2>{copy.responseQuality}</h2>
            <p>{copy.responseQualityDescription}</p>
          </header>
          <dl>
            <div>
              <dt>{copy.contactCount}</dt>
              <dd>{number.format(model.contactCount)}</dd>
            </div>
            <div>
              <dt>{copy.unresolved}</dt>
              <dd>{number.format(model.unresolvedCount)}</dd>
            </div>
            <div>
              <dt>{copy.escalated}</dt>
              <dd>{number.format(model.escalatedCount)}</dd>
            </div>
          </dl>
        </article>
        <article className="admin-report-section" id="delivery-quality">
          <header>
            <h2>{copy.delivery}</h2>
            <p>{copy.deliveryDescription}</p>
          </header>
          <dl>
            <div>
              <dt>{copy.sent}</dt>
              <dd>{number.format(model.notificationSentCount)}</dd>
            </div>
            <div>
              <dt>{copy.failed}</dt>
              <dd>{number.format(model.notificationFailedCount)}</dd>
            </div>
            <div>
              <dt>{copy.openReports}</dt>
              <dd>{number.format(model.openReportCount)}</dd>
            </div>
          </dl>
        </article>
        <article className="admin-report-section" id="qr-readiness">
          <header>
            <h2>{copy.qrProduction}</h2>
            <p>{copy.qrProductionDescription}</p>
          </header>
          <dl>
            <div>
              <dt>{copy.siteCount}</dt>
              <dd>{number.format(qrOperations.siteCount)}</dd>
            </div>
            <div>
              <dt>{copy.totalQr}</dt>
              <dd>{number.format(qrOperations.totalQr)}</dd>
            </div>
            <div>
              <dt>{copy.outputReadyBatches}</dt>
              <dd>{number.format(qrOperations.outputReadyBatches)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="console-list-surface admin-report-detail">
        <header className="console-section-heading">
          <h2>{copy.dailyDetail}</h2>
          <span>{model.windowDays}</span>
        </header>
        <DataTable columns={dailyColumns} getRowKey={(point) => point.date} rows={dailyRows} />
        <footer className="admin-report-detail__footer">
          <Pagination
            aria-label={copy.dailyDetail}
            className="admin-pagination admin-pagination--compact"
            next={
              currentDailyPage < totalDailyPages ? (
                <Link
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={reportQuery(locale, {
                    companyId,
                    endDate,
                    page: currentDailyPage + 1,
                    pageSize,
                    siteId,
                    startDate,
                  })}
                >
                  {copy.next}
                </Link>
              ) : (
                <button
                  className="tt-button tt-button--secondary tt-button--compact"
                  disabled
                  type="button"
                >
                  {copy.next}
                </button>
              )
            }
            previous={
              currentDailyPage > 1 ? (
                <Link
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={reportQuery(locale, {
                    companyId,
                    endDate,
                    page: currentDailyPage - 1,
                    pageSize,
                    siteId,
                    startDate,
                  })}
                >
                  {copy.previous}
                </Link>
              ) : (
                <button
                  className="tt-button tt-button--secondary tt-button--compact"
                  disabled
                  type="button"
                >
                  {copy.previous}
                </button>
              )
            }
            summary={dailyPageSummary}
          />
          <ConsoleQueryForm className="admin-report-page-size-form">
            <input aria-label={copy.scope} name="company" type="hidden" value={companyId ?? ""} />
            <input aria-label={copy.scope} name="site" type="hidden" value={siteId ?? ""} />
            {!isExplicitRange ? (
              <input aria-label={copy.period} name="days" type="hidden" value={model.windowDays} />
            ) : null}
            {isExplicitRange ? (
              <input aria-label={copy.startDate} name="start" type="hidden" value={startDate} />
            ) : null}
            {isExplicitRange ? (
              <input aria-label={copy.endDate} name="end" type="hidden" value={endDate} />
            ) : null}
            <label>
              <span>{copy.pageSize}</span>
              <select aria-label={copy.pageSize} defaultValue={String(pageSize)} name="pageSize">
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <input aria-label={copy.page} name="page" type="hidden" value="1" />
            <button className="tt-button tt-button--secondary tt-button--compact" type="submit">
              {copy.apply}
            </button>
          </ConsoleQueryForm>
        </footer>
      </section>
    </div>
  );
}
