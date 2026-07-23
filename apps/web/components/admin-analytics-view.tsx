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

const EMPTY_VALUE = "—";

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
  locale,
  model,
}: {
  backHref: string;
  copy: AdminAnalyticsCopy;
  locale: AppLocale;
  model: OperationsDashboardModel;
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
          {...(escalationRate !== null && escalationRate > 0 ? ({ tone: "warning" } as const) : {})}
          value={escalationRate === null ? EMPTY_VALUE : `${escalationRate}%`}
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
