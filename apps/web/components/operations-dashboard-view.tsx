import {
  ArrowRight,
  BellRinging,
  ChartLineUp,
  CheckCircle,
  MapPin,
  QrCode,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties, ReactNode } from "react";
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

function MetricCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <a className="operations-metric operations-metric--link" href={href}>
      <span className="operations-metric__icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <ArrowRight aria-hidden="true" size={16} />
    </a>
  );
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
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}s`;
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

  return (
    <div className="operations-shell operations-command-center">
      <header className="admin-compact-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <SemanticHeading className="admin-compact-title" lines={[copy.line1, copy.line2]} />
          <p>{copy.description}</p>
        </div>
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
      </header>

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

      <section className="operations-kpi-strip" aria-label={copy.todayGroup}>
        <MetricCard
          href={`${reportHref}#response-quality`}
          icon={<ChartLineUp aria-hidden="true" size={20} />}
          label={copy.contactCount}
          value={number.format(model.contactCount)}
        />
        <MetricCard
          href={`${reportHref}#response-quality`}
          icon={<WarningCircle aria-hidden="true" size={20} />}
          label={copy.unresolved}
          value={number.format(model.unresolvedCount)}
        />
        <MetricCard
          href={`${reportHref}#delivery-quality`}
          icon={<BellRinging aria-hidden="true" size={20} />}
          label={copy.sent}
          value={number.format(model.notificationSentCount)}
        />
        <MetricCard
          href={`${reportHref}#delivery-quality`}
          icon={<WarningCircle aria-hidden="true" size={20} />}
          label={copy.failed}
          value={number.format(model.notificationFailedCount)}
        />
        <MetricCard
          href={`${reportHref}#safety`}
          icon={<CheckCircle aria-hidden="true" size={20} />}
          label={copy.openReports}
          value={number.format(model.openReportCount)}
        />
        <MetricCard
          href={`${reportHref}#qr-readiness`}
          icon={<QrCode aria-hidden="true" size={20} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
      </section>

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

      <section className="operations-site-panel" aria-labelledby="site-comparison-title">
        <header>
          <div>
            <h2 id="site-comparison-title">{copy.siteComparison}</h2>
            <p>{copy.siteComparisonDescription}</p>
          </div>
          <strong>{number.format(model.siteCount)}</strong>
        </header>
        <div className="admin-command-table-wrap">
          <table className="admin-command-table operations-site-table">
            <thead>
              <tr>
                <th scope="col">{copy.siteCount}</th>
                <th scope="col">{copy.contactCount}</th>
                <th scope="col">{copy.unresolved}</th>
                <th scope="col">{copy.activeQr}</th>
                <th scope="col">{copy.detail}</th>
              </tr>
            </thead>
            <tbody>
              {model.sitePerformance.map((site) => (
                <tr key={site.siteId}>
                  <th scope="row">
                    <MapPin aria-hidden="true" size={16} /> {site.siteName}
                  </th>
                  <td>{number.format(site.contactCount)}</td>
                  <td>{number.format(site.unresolvedCount)}</td>
                  <td>{number.format(site.activeQrCount)}</td>
                  <td>
                    <a href={`/${locale}/admin/sites/${site.siteId}`}>{copy.detail}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
