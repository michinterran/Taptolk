import {
  ArrowLeft,
  BellRinging,
  ChartLine,
  QrCode,
  ShieldWarning,
} from "@phosphor-icons/react/dist/ssr";
import type { OperationsDailyPoint, OperationsDashboardModel } from "@taptolk/application";
import { DataTable, PageHeader, SideCard, StatStrip, StatTile } from "@taptolk/ui";
import type { AdminAnalyticsCopy } from "../content/admin-analytics-copy";
import type { AppLocale } from "../i18n/config";

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
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
        lines={[copy.line1, copy.line2]}
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

      <StatStrip columns={4} aria-label={copy.responseQuality}>
        <StatTile
          icon={<ChartLine aria-hidden="true" size={22} />}
          label={copy.resolutionRate}
          tone={resolutionRate >= 80 ? "success" : resolutionRate >= 50 ? "warning" : "danger"}
          value={`${resolutionRate}%`}
        />
        <StatTile
          icon={<BellRinging aria-hidden="true" size={22} />}
          label={copy.deliveryRate}
          tone={deliveryRate >= 80 ? "success" : deliveryRate >= 50 ? "warning" : "danger"}
          value={`${deliveryRate}%`}
        />
        <StatTile
          icon={<ShieldWarning aria-hidden="true" size={22} />}
          label={copy.escalationRate}
          tone={escalationRate > 0 ? "warning" : "success"}
          value={`${escalationRate}%`}
        />
        <StatTile
          icon={<QrCode aria-hidden="true" size={22} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
      </StatStrip>

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

      <SideCard
        className="admin-report-detail"
        title={copy.dailyDetail}
        actions={<span>{model.windowDays}</span>}
      >
        <DataTable
          columns={dailyColumns}
          getRowKey={(point) => point.date}
          rows={model.dailySeries}
        />
      </SideCard>
    </div>
  );
}
