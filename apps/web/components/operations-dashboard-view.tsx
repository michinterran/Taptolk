import {
  BellRinging,
  ChartLineUp,
  CheckCircle,
  MapPin,
  QrCode,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { OperationsDashboardModel, OperationsSitePerformance } from "@taptolk/application";
import { DataTable, PageHeader, SideCard, StatStrip, StatTile } from "@taptolk/ui";
import type { CSSProperties } from "react";
import type { OperationsCopy } from "../content/operations-copy";
import type { AppLocale } from "../i18n/config";

function scopeQuery(companyId?: string, siteId?: string, days?: number): string {
  const query = new URLSearchParams();
  if (companyId) query.set("company", companyId);
  if (siteId) query.set("site", siteId);
  if (days) query.set("days", String(days));
  const value = query.toString();
  return value ? `?${value}` : "";
}

export function OperationsDashboardView({
  companyId,
  copy,
  locale,
  model,
  siteId,
}: {
  companyId?: string;
  copy: OperationsCopy;
  locale: AppLocale;
  model: OperationsDashboardModel;
  siteId?: string;
}) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const responseSeconds =
    model.medianOwnerResponseMs === null
      ? "-"
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}${copy.secondsUnit}`;
  const reportHref = `/${locale}/admin/reports${scopeQuery(companyId, siteId, model.windowDays)}`;
  const maximum = Math.max(
    1,
    ...model.dailySeries.flatMap((point) => [
      point.contactCount,
      point.notificationSentCount,
      point.unresolvedCount,
    ]),
  );
  const scopeLabel = model.scopeSiteName ?? model.scopeManagementCompanyName ?? copy.scopeAll;
  const siteColumns = [
    {
      cell: (site: OperationsSitePerformance) => (
        <>
          <MapPin aria-hidden="true" size={16} /> {site.siteName}
        </>
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
        <a href={`/${locale}/admin/sites/${site.siteId}`}>{copy.detail}</a>
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
        lines={[copy.line1, copy.line2]}
        actions={
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
        }
      />

      <nav className="operations-period-nav" aria-label={copy.period}>
        <span>{copy.period}</span>
        {[7, 14, 30].map((days) => (
          <a
            aria-current={model.windowDays === days ? "page" : undefined}
            href={`/${locale}/admin/operations${scopeQuery(companyId, siteId, days)}`}
            key={days}
          >
            {days}
            {copy.days}
          </a>
        ))}
      </nav>

      <StatStrip aria-label={copy.todayGroup}>
        <StatTile
          icon={<ChartLineUp aria-hidden="true" size={20} />}
          label={copy.contactCount}
          value={number.format(model.contactCount)}
        />
        <StatTile
          icon={<WarningCircle aria-hidden="true" size={20} />}
          label={copy.unresolved}
          tone={model.unresolvedCount > 0 ? "warning" : "success"}
          value={number.format(model.unresolvedCount)}
        />
        <StatTile
          icon={<BellRinging aria-hidden="true" size={20} />}
          label={copy.sent}
          value={number.format(model.notificationSentCount)}
        />
        <StatTile
          icon={<WarningCircle aria-hidden="true" size={20} />}
          label={copy.failed}
          tone={model.notificationFailedCount > 0 ? "danger" : "success"}
          value={number.format(model.notificationFailedCount)}
        />
        <StatTile
          icon={<CheckCircle aria-hidden="true" size={20} />}
          label={copy.openReports}
          tone={model.openReportCount > 0 ? "warning" : "success"}
          value={number.format(model.openReportCount)}
        />
        <StatTile
          badge={<a href={`${reportHref}#qr-readiness`}>{copy.detail}</a>}
          icon={<QrCode aria-hidden="true" size={20} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
      </StatStrip>

      <section className="operations-trend-panel" aria-labelledby="operations-trend-title">
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
        <div className="operations-column-chart" role="img" aria-label={copy.trendDescription}>
          {model.dailySeries.map((point) => (
            <div className="operations-column-chart__day" key={point.date}>
              <div className="operations-column-chart__bars">
                <i
                  className="operations-column-chart__bar operations-column-chart__bar--contact"
                  style={
                    { "--chart-value": `${(point.contactCount / maximum) * 100}%` } as CSSProperties
                  }
                  title={`${copy.contactCount}: ${number.format(point.contactCount)}`}
                />
                <i
                  className="operations-column-chart__bar operations-column-chart__bar--sent"
                  style={
                    {
                      "--chart-value": `${(point.notificationSentCount / maximum) * 100}%`,
                    } as CSSProperties
                  }
                  title={`${copy.sent}: ${number.format(point.notificationSentCount)}`}
                />
                <i
                  className="operations-column-chart__bar operations-column-chart__bar--unresolved"
                  style={
                    {
                      "--chart-value": `${(point.unresolvedCount / maximum) * 100}%`,
                    } as CSSProperties
                  }
                  title={`${copy.unresolved}: ${number.format(point.unresolvedCount)}`}
                />
              </div>
              <time dateTime={point.date}>{date.format(new Date(`${point.date}T00:00:00Z`))}</time>
            </div>
          ))}
        </div>
      </section>

      <SideCard
        className="operations-site-panel"
        title={copy.siteComparison}
        actions={<strong>{number.format(model.siteCount)}</strong>}
      >
        <p>{copy.siteComparisonDescription}</p>
        <DataTable
          columns={siteColumns}
          getRowKey={(site) => site.siteId}
          rows={model.sitePerformance}
        />
      </SideCard>

      <aside className="operations-manual">
        <h2>{copy.manualGates}</h2>
        <p>{copy.manualGatesDescription}</p>
        <span>
          {copy.medianResponse}: {responseSeconds}
        </span>
      </aside>
    </div>
  );
}
