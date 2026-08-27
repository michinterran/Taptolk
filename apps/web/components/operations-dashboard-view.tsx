import {
  ArrowRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  MapPin,
  QrCode,
} from "@phosphor-icons/react/dist/ssr";
import type {
  OperationsDashboardModel,
  OperationsSitePerformance,
  OperationsWorkItem,
  OperationsWorkQueueModel,
} from "@taptolk/application";
import { DataTable, PageColumns, PageHeader, Pagination, StatStrip, StatTile } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { mutateOperationsWorkQueue } from "../admin/operations-work-queue-actions";
import type { QrOperationsScopeSummary } from "../admin/qr-operations-scope-summary";
import type { OperationsCopy } from "../content/operations-copy";
import type { AppLocale } from "../i18n/config";
import { ConsoleQueryForm } from "./console-query-form";

const CHART_WIDTH = 1_000;
const CHART_TOP = 18;
const CHART_BOTTOM = 214;

function scopeQuery({
  companyId,
  comparePrevious,
  days,
  endDate,
  page,
  pageSize,
  siteId,
  startDate,
}: {
  companyId?: string | undefined;
  comparePrevious?: boolean | undefined;
  days?: number | undefined;
  endDate?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  siteId?: string | undefined;
  startDate?: string | undefined;
}): string {
  const query = new URLSearchParams();
  if (companyId) query.set("company", companyId);
  if (siteId) query.set("site", siteId);
  if (days) query.set("days", String(days));
  if (startDate) query.set("start", startDate);
  if (endDate) query.set("end", endDate);
  if (comparePrevious) query.set("compare", "previous");
  if (page && page > 1) query.set("page", String(page));
  if (pageSize && pageSize !== 10) query.set("pageSize", String(pageSize));
  const value = query.toString();
  return value ? `?${value}` : "";
}

function template(value: string, substitutions: Record<string, string>): string {
  return Object.entries(substitutions).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, replacement),
    value,
  );
}

function visiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function chartPoints(values: readonly number[], maximum: number): readonly [number, number][] {
  const denominator = Math.max(values.length - 1, 1);
  return values.map((value, index) => [
    (index / denominator) * CHART_WIDTH,
    CHART_BOTTOM - (value / maximum) * (CHART_BOTTOM - CHART_TOP),
  ]);
}

function linePath(points: readonly [number, number][]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function areaPath(points: readonly [number, number][]): string {
  if (points.length === 0) return "";
  return `M 0 ${CHART_BOTTOM} ${points
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")} L ${CHART_WIDTH} ${CHART_BOTTOM} Z`;
}

export function OperationsDashboardView({
  companyId,
  comparePrevious,
  comparisonModel,
  copy,
  currentPage,
  endDate,
  locale,
  model,
  pageSize,
  qrOperations,
  siteId,
  startDate,
  workQueue,
}: {
  companyId?: string;
  comparePrevious: boolean;
  comparisonModel?: OperationsDashboardModel;
  copy: OperationsCopy;
  currentPage: number;
  endDate: string;
  locale: AppLocale;
  model: OperationsDashboardModel;
  pageSize: number;
  qrOperations: QrOperationsScopeSummary;
  siteId?: string;
  startDate: string;
  workQueue: OperationsWorkQueueModel | null;
}) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const isRollingRange = endDate === todayKey;
  const responseSeconds =
    model.medianOwnerResponseMs === null
      ? "-"
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}${copy.secondsUnit}`;
  const reportHref = `/${locale}/admin/reports${scopeQuery({
    companyId,
    days: model.windowDays,
    siteId,
  })}` as Route;
  const queryState = { companyId, comparePrevious, endDate, siteId, startDate };
  const maximum = Math.max(
    1,
    ...model.dailySeries.flatMap((point) => [
      point.contactCount,
      point.notificationSentCount,
      point.unresolvedCount,
    ]),
    ...(comparisonModel?.dailySeries.flatMap((point) => [point.contactCount]) ?? []),
  );
  const contactPoints = chartPoints(
    model.dailySeries.map((point) => point.contactCount),
    maximum,
  );
  const sentPoints = chartPoints(
    model.dailySeries.map((point) => point.notificationSentCount),
    maximum,
  );
  const unresolvedPoints = chartPoints(
    model.dailySeries.map((point) => point.unresolvedCount),
    maximum,
  );
  const comparisonContactPoints = comparisonModel
    ? chartPoints(
        comparisonModel.dailySeries.map((point) => point.contactCount),
        maximum,
      )
    : [];
  const hasTrendData = model.dailySeries.some(
    (point) =>
      point.contactCount > 0 || point.notificationSentCount > 0 || point.unresolvedCount > 0,
  );
  const scopeLabel = model.scopeSiteName ?? model.scopeManagementCompanyName ?? copy.scopeAll;
  const periodDates = [
    model.dailySeries.at(0),
    model.dailySeries.at(Math.floor((model.dailySeries.length - 1) / 2)),
    model.dailySeries.at(-1),
  ].filter((point): point is (typeof model.dailySeries)[number] => Boolean(point));
  const totalSites = model.sitePerformance.length;
  const totalPages = Math.max(1, Math.ceil(totalSites / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedSites = model.sitePerformance.slice(pageStart, pageStart + pageSize);
  const pageEnd = Math.min(pageStart + pagedSites.length, totalSites);
  const pages = visiblePages(safePage, totalPages);
  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const workQueueItems = workQueue?.items ?? [];
  const workQueueReturnPath = `/${locale}/admin/operations${scopeQuery({
    companyId,
    comparePrevious,
    endDate,
    page: currentPage,
    pageSize,
    siteId,
    startDate,
  })}`;
  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return relativeTime.format(-seconds, "second");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return relativeTime.format(-minutes, "minute");
    return relativeTime.format(-Math.floor(minutes / 60), "hour");
  };
  const workQueueColumns = [
    {
      cell: (item: OperationsWorkItem) => copy.workKinds[item.kind] ?? copy.workNotSet,
      header: copy.workType,
      key: "type",
    },
    {
      cell: (item: OperationsWorkItem) => (
        <span className="operations-work-location">
          <strong>{item.managementCompanyName}</strong>
          <span>{item.siteName}</span>
        </span>
      ),
      header: copy.workLocation,
      key: "location",
    },
    {
      cell: (item: OperationsWorkItem) => (
        <span className="operations-work-status">
          <strong>{copy.workQueueStates[item.queueState] ?? copy.workNotSet}</strong>
          <span>{copy.workStatuses[item.sourceStatus] ?? copy.workNotSet}</span>
        </span>
      ),
      header: copy.workStatus,
      key: "status",
    },
    {
      cell: (item: OperationsWorkItem) => formatElapsed(item.elapsedSeconds),
      header: copy.workElapsed,
      key: "elapsed",
    },
    {
      cell: (item: OperationsWorkItem) =>
        item.lastAttemptAt ? (
          <time dateTime={item.lastAttemptAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
              new Date(item.lastAttemptAt),
            )}
          </time>
        ) : (
          copy.workNotSet
        ),
      header: copy.workLastAttempt,
      key: "lastAttempt",
    },
    {
      cell: (item: OperationsWorkItem) => item.assigneeDisplayName ?? copy.workUnassigned,
      header: copy.workAssignee,
      key: "assignee",
    },
    {
      cell: (item: OperationsWorkItem) => item.priority ?? copy.workNotSet,
      header: copy.workPriority,
      key: "priority",
    },
    {
      cell: (item: OperationsWorkItem) => item.sla ?? copy.workNotSet,
      header: copy.workSla,
      key: "sla",
    },
    {
      cell: (item: OperationsWorkItem) => {
        const action = (
          type: "ACKNOWLEDGE" | "ASSIGN" | "START" | "RESOLVE" | "RETRY",
          label: string,
        ) => (
          <form action={mutateOperationsWorkQueue} className="operations-work-action-form">
            <input aria-label={copy.workActions} name="locale" type="hidden" value={locale} />
            <input
              aria-label={copy.workActions}
              name="returnPath"
              type="hidden"
              value={workQueueReturnPath}
            />
            <input aria-label={copy.workActions} name="itemId" type="hidden" value={item.id} />
            <input aria-label={copy.workActions} name="kind" type="hidden" value={item.kind} />
            <input
              aria-label={copy.workActions}
              name="expectedVersion"
              type="hidden"
              value={item.version}
            />
            <input aria-label={copy.workActions} name="type" type="hidden" value={type} />
            <input
              aria-label={copy.workActions}
              name="reason"
              type="hidden"
              value={copy.workDefaultReason}
            />
            <button className="tt-button tt-button--secondary tt-button--compact" type="submit">
              {label}
            </button>
          </form>
        );
        const actions = [];
        if (item.queueState === "WAITING") {
          actions.push(action("ACKNOWLEDGE", copy.workAcknowledge));
        }
        if (item.queueState !== "RESOLVED" && item.assigneeDisplayName === null) {
          actions.push(action("ASSIGN", copy.workAssignSelf));
        }
        if (item.queueState === "ACKNOWLEDGED" || item.queueState === "ASSIGNED") {
          actions.push(action("START", copy.workStart));
        }
        if (item.queueState === "IN_PROGRESS") {
          actions.push(action("RESOLVE", copy.workResolve));
        }
        if (item.kind === "NOTIFICATION_FAILURE" && item.queueState !== "RESOLVED") {
          actions.push(action("RETRY", copy.workRetry));
        }
        return <span className="operations-work-actions">{actions}</span>;
      },
      header: copy.workActions,
      key: "actions",
    },
    {
      cell: (item: OperationsWorkItem) => {
        const href = item.actions.includes("OPEN_REPORT")
          ? `/${locale}/admin/reports`
          : `/${locale}/admin/sites/${item.siteId}`;
        return (
          <Link className="tt-row-action" href={href as Route}>
            {copy.workOpen}
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        );
      },
      header: copy.workOpen,
      key: "open",
    },
  ];
  const siteColumns = [
    {
      cell: (site: OperationsSitePerformance) => (
        <span className="operations-site-entity">
          <MapPin aria-hidden="true" size={16} /> {site.siteName}
        </span>
      ),
      header: copy.siteCount,
      key: "site",
    },
    {
      align: "right" as const,
      cell: (site: OperationsSitePerformance) => number.format(site.contactCount),
      header: copy.contactCount,
      key: "contacts",
    },
    {
      align: "right" as const,
      cell: (site: OperationsSitePerformance) => number.format(site.unresolvedCount),
      header: copy.unresolved,
      key: "unresolved",
    },
    {
      align: "right" as const,
      cell: (site: OperationsSitePerformance) => number.format(site.activeQrCount),
      header: copy.activeQr,
      key: "activeQr",
    },
    {
      cell: (site: OperationsSitePerformance) => (
        <Link className="tt-row-action" href={`/${locale}/admin/sites/${site.siteId}`}>
          {copy.detail}
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
      ),
      header: copy.detail,
      key: "detail",
    },
  ];

  return (
    <div className="operations-shell operations-command-center">
      <PageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={[copy.line1]}
        actions={
          <dl className="operations-header-meta">
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
        }
      />

      <section className="operations-period-controls" aria-label={copy.period}>
        <nav className="tt-console-tabs operations-period-tabs" aria-label={copy.period}>
          {[1, 7, 14, 30, 90].map((days) => (
            <Link
              aria-current={isRollingRange && model.windowDays === days ? "page" : undefined}
              href={
                `/${locale}/admin/operations${scopeQuery({
                  ...queryState,
                  days,
                  endDate: undefined,
                  page: 1,
                  startDate: undefined,
                })}` as Route
              }
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
            <input
              aria-label={copy.comparePrevious}
              name="compare"
              type="hidden"
              value={comparePrevious ? "previous" : ""}
            />
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

        <Link
          className="operations-compare-toggle"
          href={
            `/${locale}/admin/operations${scopeQuery({
              ...queryState,
              comparePrevious: !comparePrevious,
              page: 1,
            })}` as Route
          }
          aria-pressed={comparePrevious}
        >
          {comparePrevious ? copy.comparePreviousActive : copy.comparePrevious}
        </Link>
      </section>

      <section
        aria-labelledby="operations-work-queue-title"
        className="console-list-surface operations-work-queue-panel"
      >
        <header className="console-section-heading">
          <div>
            <h2 id="operations-work-queue-title">{copy.workQueue}</h2>
            <p>{workQueue ? copy.workQueueDescription : copy.workQueueUnavailable}</p>
          </div>
          <span className="operations-work-queue-count">
            {workQueue
              ? template(copy.workQueueCount, {
                  count: `${number.format(workQueueItems.length)}${workQueue.hasMore ? "+" : ""}`,
                })
              : copy.workNotSet}
          </span>
        </header>
        <DataTable
          className="operations-work-queue-table"
          columns={workQueueColumns}
          empty={workQueue ? copy.workQueueEmpty : copy.workQueueUnavailable}
          getRowKey={(item) => `${item.kind}-${item.id}`}
          rows={workQueueItems}
        />
      </section>

      <PageColumns
        className="operations-monitoring-layout"
        rail={
          <aside className="operations-live-rail" aria-labelledby="operations-live-title">
            <header>
              <div>
                <h2 id="operations-live-title">{copy.liveStatus}</h2>
                <p>
                  <span aria-hidden="true" />
                  {copy.liveUpdating}
                </p>
              </div>
              <time dateTime={model.freshAt}>
                {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
                  new Date(model.freshAt),
                )}
              </time>
            </header>

            <dl className="operations-live-metrics">
              <div>
                <dt>{copy.contactCount}</dt>
                <dd>{number.format(model.contactCount)}</dd>
              </div>
              <div>
                <dt>{copy.unresolved}</dt>
                <dd>{number.format(model.unresolvedCount)}</dd>
              </div>
              <div>
                <dt>{copy.medianResponse}</dt>
                <dd>{responseSeconds}</dd>
              </div>
              <div>
                <dt>{copy.openReports}</dt>
                <dd>{number.format(model.openReportCount)}</dd>
              </div>
            </dl>

            <section className="operations-rail-section">
              <header>
                <div>
                  <h3>{copy.inventoryGroup}</h3>
                  <p>{copy.qrSnapshotDescription}</p>
                </div>
                <QrCode aria-hidden="true" size={18} />
              </header>
              <dl>
                <div>
                  <dt>{copy.activeQr}</dt>
                  <dd>{number.format(qrOperations.activeQr)}</dd>
                </div>
                <div>
                  <dt>{copy.pendingActivation}</dt>
                  <dd>{number.format(qrOperations.pendingActivationQr)}</dd>
                </div>
                <div>
                  <dt>{copy.outputReadyBatches}</dt>
                  <dd>{number.format(qrOperations.outputReadyBatches)}</dd>
                </div>
              </dl>
              <Link
                className="tt-row-action"
                href={`/${locale}/admin/qr-inventory${scopeQuery({ companyId, siteId })}` as Route}
              >
                {copy.qrConsole}
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </section>

            <section className="operations-rail-section operations-rail-section--gate">
              <header>
                <div>
                  <h3>{copy.manualGates}</h3>
                  <p>{copy.manualGatesDescription}</p>
                </div>
                <CheckCircle aria-hidden="true" size={18} />
              </header>
              <Link className="tt-row-action" href={`${reportHref}#qr-readiness` as Route}>
                {copy.reviewChecks}
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </section>
          </aside>
        }
      >
        <section
          className="console-analytics-frame operations-trend-panel"
          aria-labelledby="operations-trend-title"
        >
          <StatStrip aria-label={copy.todayGroup} columns={4}>
            <StatTile
              className="operations-primary-metric"
              delta={copy.todayGroup}
              label={copy.contactCount}
              value={number.format(model.contactCount)}
            />
            <StatTile
              delta={copy.todayGroup}
              label={copy.unresolved}
              tone={model.unresolvedCount > 0 ? "warning" : "success"}
              value={number.format(model.unresolvedCount)}
            />
            <StatTile
              delta={copy.todayGroup}
              label={copy.sent}
              value={number.format(model.notificationSentCount)}
            />
            <StatTile
              delta={copy.todayGroup}
              label={copy.failed}
              tone={model.notificationFailedCount > 0 ? "danger" : "success"}
              value={number.format(model.notificationFailedCount)}
            />
          </StatStrip>
          <header>
            <div>
              <h2 id="operations-trend-title">{copy.trend}</h2>
              <p>{copy.trendDescription}</p>
            </div>
            <div className="operations-chart-legend">
              <span className="operations-chart-legend--contact">{copy.contactCount}</span>
              <span className="operations-chart-legend--sent">{copy.sent}</span>
              <span className="operations-chart-legend--unresolved">{copy.unresolved}</span>
            </div>
          </header>
          {hasTrendData ? (
            <figure className="operations-line-chart">
              <svg
                aria-labelledby="operations-chart-title operations-chart-description"
                preserveAspectRatio="none"
                role="img"
                viewBox={`0 0 ${CHART_WIDTH} 232`}
              >
                <title id="operations-chart-title">{copy.trend}</title>
                <desc id="operations-chart-description">{copy.trendDescription}</desc>
                {[18, 83, 148, 214].map((y) => (
                  <line
                    className="operations-line-chart__grid"
                    key={y}
                    x1="0"
                    x2="1000"
                    y1={y}
                    y2={y}
                  />
                ))}
                <path className="operations-line-chart__area" d={areaPath(contactPoints)} />
                {comparisonModel ? (
                  <path
                    className="operations-line-chart__line operations-line-chart__line--comparison"
                    d={linePath(comparisonContactPoints)}
                  />
                ) : null}
                <path
                  className="operations-line-chart__line operations-line-chart__line--contact"
                  d={linePath(contactPoints)}
                />
                <path
                  className="operations-line-chart__line operations-line-chart__line--sent"
                  d={linePath(sentPoints)}
                />
                <path
                  className="operations-line-chart__line operations-line-chart__line--unresolved"
                  d={linePath(unresolvedPoints)}
                />
              </svg>
              <figcaption>
                {periodDates.map((point) => (
                  <time dateTime={point.date} key={point.date}>
                    {date.format(new Date(`${point.date}T00:00:00Z`))}
                  </time>
                ))}
              </figcaption>
            </figure>
          ) : (
            <div className="operations-chart-empty" role="status">
              <span className="operations-chart-empty__line" aria-hidden="true" />
              <p>{copy.noTrendData}</p>
            </div>
          )}
        </section>

        <section className="console-list-surface operations-site-panel">
          <header className="console-section-heading">
            <div>
              <h2>{copy.siteComparison}</h2>
              <p>{copy.siteComparisonDescription}</p>
            </div>
            <span className="operations-site-count">
              {template(copy.totalSites, {
                end: number.format(pageEnd),
                start: number.format(totalSites === 0 ? 0 : pageStart + 1),
                total: number.format(totalSites),
              })}
            </span>
          </header>
          <DataTable
            columns={siteColumns}
            empty={copy.emptySites}
            getRowKey={(site) => site.siteId}
            rows={pagedSites}
          />
          <footer className="operations-site-footer">
            <span>
              {template(copy.totalSites, {
                end: number.format(pageEnd),
                start: number.format(totalSites === 0 ? 0 : pageStart + 1),
                total: number.format(totalSites),
              })}
            </span>
            <Pagination
              aria-label={copy.paginationLabel}
              next={
                safePage < totalPages ? (
                  <Link
                    aria-label={copy.pageNext}
                    href={
                      `/${locale}/admin/operations${scopeQuery({
                        ...queryState,
                        page: safePage + 1,
                        pageSize,
                      })}` as Route
                    }
                  >
                    <CaretRight aria-hidden="true" size={16} />
                  </Link>
                ) : (
                  <span aria-disabled="true">
                    <CaretRight aria-hidden="true" size={16} />
                  </span>
                )
              }
              pages={pages.map((page) => (
                <Link
                  aria-current={page === safePage ? "page" : undefined}
                  href={
                    `/${locale}/admin/operations${scopeQuery({
                      ...queryState,
                      page,
                      pageSize,
                    })}` as Route
                  }
                  key={page}
                >
                  {number.format(page)}
                </Link>
              ))}
              previous={
                safePage > 1 ? (
                  <Link
                    aria-label={copy.pagePrevious}
                    href={
                      `/${locale}/admin/operations${scopeQuery({
                        ...queryState,
                        page: safePage - 1,
                        pageSize,
                      })}` as Route
                    }
                  >
                    <CaretLeft aria-hidden="true" size={16} />
                  </Link>
                ) : (
                  <span aria-disabled="true">
                    <CaretLeft aria-hidden="true" size={16} />
                  </span>
                )
              }
              summary=""
            />
            <ConsoleQueryForm className="operations-page-size">
              <input aria-label={copy.scope} name="company" type="hidden" value={companyId ?? ""} />
              <input aria-label={copy.scope} name="site" type="hidden" value={siteId ?? ""} />
              <input aria-label={copy.startDate} name="start" type="hidden" value={startDate} />
              <input aria-label={copy.endDate} name="end" type="hidden" value={endDate} />
              <input
                aria-label={copy.comparePrevious}
                name="compare"
                type="hidden"
                value={comparePrevious ? "previous" : ""}
              />
              <label>
                <span>{copy.pageSize}</span>
                <select aria-label={copy.pageSize} defaultValue={pageSize} name="pageSize">
                  {[10, 25, 50].map((value) => (
                    <option key={value} value={value}>
                      {number.format(value)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="tt-button tt-button--secondary tt-button--compact" type="submit">
                {copy.apply}
              </button>
            </ConsoleQueryForm>
          </footer>
        </section>
      </PageColumns>
    </div>
  );
}
