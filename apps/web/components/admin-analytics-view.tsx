import {
  ArrowLeft,
  BellRinging,
  ChartLine,
  QrCode,
  ShieldWarning,
} from "@phosphor-icons/react/dist/ssr";
import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties, ReactNode } from "react";
import type { AdminAnalyticsCopy } from "../content/admin-analytics-copy";
import type { AppLocale } from "../i18n/config";

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function RateCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="admin-report-rate-card">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}%</strong>
      </div>
      <i aria-hidden="true" style={{ "--report-rate": `${value}%` } as CSSProperties} />
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
  const contactTotal = Math.max(model.contactCount, 1);
  const deliveryTotal = Math.max(
    model.notificationSentCount + model.notificationFailedCount + model.notificationRetryCount,
    1,
  );
  const resolutionRate = 100 - percent(model.unresolvedCount, contactTotal);
  const deliveryRate = percent(model.notificationSentCount, deliveryTotal);
  const escalationRate = percent(model.escalatedCount, contactTotal);
  const scopeLabel = model.scopeSiteName ?? model.scopeManagementCompanyName ?? copy.scopeAll;

  return (
    <div className="operations-shell admin-report-shell">
      <header className="admin-compact-heading">
        <div>
          <a className="operations-back operations-back--compact" href={backHref}>
            <ArrowLeft aria-hidden="true" size={15} /> {copy.back}
          </a>
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

      <section className="admin-report-rate-grid" aria-label={copy.responseQuality}>
        <RateCard
          icon={<ChartLine aria-hidden="true" size={22} />}
          label={copy.resolutionRate}
          value={resolutionRate}
        />
        <RateCard
          icon={<BellRinging aria-hidden="true" size={22} />}
          label={copy.deliveryRate}
          value={deliveryRate}
        />
        <RateCard
          icon={<ShieldWarning aria-hidden="true" size={22} />}
          label={copy.escalationRate}
          value={escalationRate}
        />
        <RateCard
          icon={<QrCode aria-hidden="true" size={22} />}
          label={copy.activeQr}
          value={percent(model.activeQrCount, Math.max(model.activeQrCount + model.siteCount, 1))}
        />
      </section>

      <section className="admin-report-grid">
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
              <dd>{number.format(model.siteCount)}</dd>
            </div>
            <div>
              <dt>{copy.activeQr}</dt>
              <dd>{number.format(model.activeQrCount)}</dd>
            </div>
            <div>
              <dt>{copy.openReports}</dt>
              <dd>{number.format(model.openReportCount)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="admin-report-detail" aria-labelledby="daily-report-title">
        <header>
          <h2 id="daily-report-title">{copy.dailyDetail}</h2>
          <span>{model.windowDays}</span>
        </header>
        <div className="admin-command-table-wrap">
          <table className="admin-command-table admin-report-table">
            <thead>
              <tr>
                <th scope="col">{copy.date}</th>
                <th scope="col">{copy.contactCount}</th>
                <th scope="col">{copy.unresolved}</th>
                <th scope="col">{copy.escalated}</th>
                <th scope="col">{copy.sent}</th>
                <th scope="col">{copy.failed}</th>
              </tr>
            </thead>
            <tbody>
              {model.dailySeries.map((point) => (
                <tr key={point.date}>
                  <th scope="row">
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                      new Date(`${point.date}T00:00:00Z`),
                    )}
                  </th>
                  <td>{number.format(point.contactCount)}</td>
                  <td>{number.format(point.unresolvedCount)}</td>
                  <td>{number.format(point.escalatedCount)}</td>
                  <td>{number.format(point.notificationSentCount)}</td>
                  <td>{number.format(point.notificationFailedCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
