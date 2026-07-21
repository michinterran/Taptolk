import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties, ReactNode } from "react";
import type { AdminAnalyticsCopy } from "../content/admin-analytics-copy";
import type { AppLocale } from "../i18n/config";

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function AnalyticsBar({
  label,
  value,
  variant = "violet",
}: {
  label: string;
  value: number;
  variant?: "green" | "orange" | "red" | "violet";
}) {
  return (
    <div className={`admin-analytics-bar admin-analytics-bar--${variant}`}>
      <span>{label}</span>
      <i aria-hidden="true" style={{ "--admin-analytics-value": `${value}%` } as CSSProperties} />
      <strong>{value}%</strong>
    </div>
  );
}

function AnalyticsCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <article className="admin-analytics-card">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </article>
  );
}

export function AdminAnalyticsView({
  backHref,
  copy,
  locale,
  model,
}: {
  backHref: string;
  copy: AdminAnalyticsCopy;
  locale: AppLocale;
  model: OperationsDashboardModel;
}) {
  const number = new Intl.NumberFormat(locale);
  const totalContacts = Math.max(model.contactCount, 1);
  const totalDeliveries = Math.max(model.notificationSentCount, 1);
  const qrBase = Math.max(model.activeQrCount + model.completedBatchCount, 1);

  return (
    <div className="operations-shell admin-analytics-shell">
      <a className="operations-back" href={backHref}>
        {copy.back}
      </a>
      <header className="operations-hero admin-analytics-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <SemanticHeading className="operations-title" lines={[copy.line1, copy.line2]} />
        <p>{copy.description}</p>
      </header>

      <section className="admin-analytics-grid" aria-label={copy.eyebrow}>
        <AnalyticsCard description={copy.responseQualityDescription} title={copy.responseQuality}>
          <dl className="admin-analytics-kpis">
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
          <AnalyticsBar
            label={copy.contactCount}
            value={percent(model.contactCount, totalContacts)}
          />
          <AnalyticsBar
            label={copy.unresolved}
            value={percent(model.unresolvedCount, totalContacts)}
            variant="orange"
          />
          <AnalyticsBar
            label={copy.escalated}
            value={percent(model.escalatedCount, totalContacts)}
            variant="red"
          />
        </AnalyticsCard>

        <AnalyticsCard description={copy.deliveryDescription} title={copy.delivery}>
          <dl className="admin-analytics-kpis">
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
          <AnalyticsBar
            label={copy.sent}
            value={100 - percent(model.notificationFailedCount, totalDeliveries)}
            variant="green"
          />
          <AnalyticsBar
            label={copy.failed}
            value={percent(model.notificationFailedCount, totalDeliveries)}
            variant="red"
          />
          <AnalyticsBar
            label={copy.openReports}
            value={percent(
              model.openReportCount,
              Math.max(model.openReportCount + model.contactCount, 1),
            )}
            variant="orange"
          />
        </AnalyticsCard>

        <AnalyticsCard description={copy.qrProductionDescription} title={copy.qrProduction}>
          <dl className="admin-analytics-kpis">
            <div>
              <dt>{copy.siteCount}</dt>
              <dd>{number.format(model.siteCount)}</dd>
            </div>
            <div>
              <dt>{copy.activeQr}</dt>
              <dd>{number.format(model.activeQrCount)}</dd>
            </div>
          </dl>
          <div className="admin-analytics-funnel" aria-hidden="true">
            <span style={{ "--funnel-value": "100%" } as CSSProperties}>{copy.siteCount}</span>
            <span
              style={
                {
                  "--funnel-value": `${Math.max(18, percent(model.activeQrCount, qrBase))}%`,
                } as CSSProperties
              }
            >
              {copy.activeQr}
            </span>
            <span
              style={
                {
                  "--funnel-value": `${Math.max(18, percent(model.openReportCount, qrBase))}%`,
                } as CSSProperties
              }
            >
              {copy.openReports}
            </span>
          </div>
        </AnalyticsCard>
      </section>

      <p className="operations-freshness">
        {copy.freshAt}:{" "}
        <time dateTime={model.freshAt}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "medium",
          }).format(new Date(model.freshAt))}
        </time>
      </p>
    </div>
  );
}
