import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { ManagementCompanyCatalogItem, OperationsDashboardModel } from "@taptolk/application";
import { MeterBar, StatusPill } from "@taptolk/ui";
import type { AdminOverviewCopy } from "../content/admin-overview-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

type DashboardVariant = "customer" | "platform";

interface AdminDashboardViewProps {
  canApproveAccounts: boolean;
  companyPortfolio?: readonly ManagementCompanyCatalogItem[];
  copy: AdminOverviewCopy;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: OperationsDashboardModel;
  pathname: string;
  variant: DashboardVariant;
}

function percent(part: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function formatFreshAt(locale: AppLocale, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboardView({
  canApproveAccounts,
  companyPortfolio = [],
  copy,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  pathname,
  variant,
}: AdminDashboardViewProps) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const prefix = `/${locale}/admin`;
  const isPlatform = variant === "platform";
  const title = isPlatform ? copy.platformLine1 : copy.workspaceLine1;
  const description = isPlatform ? copy.platformDescription : copy.workspaceDescription;
  const eyebrow = isPlatform ? copy.platformEyebrow : copy.workspaceEyebrow;
  const responseValue =
    model.medianOwnerResponseMs === null
      ? copy.noResponseData
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}${copy.seconds}`;
  const deliveryFailureRate = percent(
    model.notificationFailedCount + model.notificationRetryCount,
    model.notificationSentCount,
  );
  const deliverySuccessRate = deliveryFailureRate === null ? null : 100 - deliveryFailureRate;
  const platformVehicleCapacity = companyPortfolio.reduce(
    (total, company) => total + company.contractVehicleLimit,
    0,
  );
  const overviewMetrics = isPlatform
    ? [
        { label: copy.company, value: number.format(companyPortfolio.length) },
        { label: copy.siteCount, value: number.format(model.siteCount) },
        { label: copy.contractCapacity, value: number.format(platformVehicleCapacity) },
        { label: copy.activeQr, value: number.format(model.activeQrCount) },
      ]
    : [
        { label: copy.siteCount, value: number.format(model.siteCount) },
        { label: copy.activeQr, value: number.format(model.activeQrCount) },
        { label: copy.contactCount, value: number.format(model.contactCount) },
        { label: copy.medianResponse, value: responseValue },
      ];
  const attentionItems = [
    {
      count: model.unresolvedCount,
      description: copy.actionOperationsDescription,
      href: `${prefix}/operations`,
      label: copy.unresolved,
    },
    {
      count: model.escalatedCount,
      description: copy.attentionDescription,
      href: `${prefix}/operations`,
      label: copy.escalated,
    },
    {
      count: model.notificationFailedCount,
      description: copy.deliveryHealthDescription,
      href: `${prefix}/operations`,
      label: copy.failedNotifications,
    },
    {
      count: model.openReportCount,
      description: copy.actionReportsDescription,
      href: `${prefix}/reports`,
      label: copy.openReports,
    },
  ];
  const quickActions = [
    {
      description: copy.actionManagementCompaniesDescription,
      href: `${prefix}/platform/management-companies`,
      label: copy.actionManagementCompanies,
    },
    {
      description: copy.actionSitesDescription,
      href: `${prefix}/sites`,
      label: copy.actionSites,
    },
    {
      description: copy.actionQrDescription,
      href: `${prefix}/qr-inventory`,
      label: copy.actionQr,
    },
    {
      description: copy.actionOperationsDescription,
      href: `${prefix}/operations`,
      label: copy.actionOperations,
    },
    {
      description: copy.actionReportsDescription,
      href: `${prefix}/reports`,
      label: copy.actionReports,
    },
  ];
  if (canApproveAccounts) {
    quickActions.push({
      description: copy.actionApprovalsDescription,
      href: `${prefix}/platform/access`,
      label: copy.actionApprovals,
    });
  }
  const customerRows = isPlatform
    ? companyPortfolio.slice(0, 7).map((company) => ({
        activeQr: company.activeQrCount,
        href: `${prefix}/platform/management-companies/${company.id}`,
        name: company.name,
        progress: percent(company.activeQrCount, company.contractVehicleLimit),
        secondary: `${copy.tableLocations} ${number.format(company.siteCount)} · ${
          copy.contractCapacity
        } ${number.format(company.contractVehicleLimit)}`,
        status: company.status === "ACTIVE" ? copy.statusHealthy : copy.statusAttention,
        tone: company.status === "ACTIVE" ? ("success" as const) : ("warning" as const),
      }))
    : model.sitePerformance.slice(0, 7).map((site) => ({
        activeQr: site.activeQrCount,
        href: `${prefix}/sites/${site.siteId}`,
        name: site.siteName,
        progress: percent(site.activeQrCount, Math.max(site.activeQrCount, site.contactCount)),
        secondary: `${copy.tableRequests} ${number.format(site.contactCount)} · ${
          copy.tableOpenIssues
        } ${number.format(site.unresolvedCount)}`,
        status: site.unresolvedCount > 0 ? copy.statusAttention : copy.statusHealthy,
        tone: site.unresolvedCount > 0 ? ("warning" as const) : ("success" as const),
      }));

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={pathname}
      />

      <div className="admin-reference-page admin-reference-page--dashboard">
        <section className="admin-reference-board" aria-labelledby="admin-dashboard-title">
          <header className="admin-reference-hero">
            <div>
              <p className="admin-reference-kicker">{eyebrow}</p>
              <h1 id="admin-dashboard-title">{title}</h1>
              <p>{description}</p>
            </div>
            <div className="admin-reference-hero__meta">
              <StatusPill
                tone={
                  deliverySuccessRate === null || deliverySuccessRate >= 95 ? "success" : "warning"
                }
              >
                {deliverySuccessRate === null
                  ? copy.statusHealthy
                  : `${copy.deliveryHealth} ${deliverySuccessRate}%`}
              </StatusPill>
              <a className="admin-reference-refresh" href={pathname}>
                {copy.refreshData}
              </a>
            </div>
          </header>

          <section className="admin-reference-metrics" aria-label={copy.overviewTitle}>
            {overviewMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="admin-reference-monitor" aria-labelledby="admin-monitor-title">
            <header>
              <div>
                <h2 id="admin-monitor-title">{copy.attentionTitle}</h2>
                <p>{copy.actionsDescription}</p>
              </div>
              <time dateTime={model.freshAt}>
                {copy.freshAt}: {formatFreshAt(locale, model.freshAt)}
              </time>
            </header>
            <div className="admin-reference-queue">
              {attentionItems.map((item) => (
                <a href={item.href} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{number.format(item.count)}</strong>
                  <small>{item.description}</small>
                </a>
              ))}
            </div>
            {attentionItems.every((item) => item.count === 0) ? (
              <p className="admin-reference-empty">{copy.healthyDescription}</p>
            ) : null}
          </section>

          <section className="admin-reference-flow" aria-labelledby="admin-flow-title">
            <div>
              <h2 id="admin-flow-title">{copy.operationFlow}</h2>
              <p>{copy.operationFlowDescription}</p>
            </div>
            <div className="admin-reference-flow__bars">
              <div>
                <span>{copy.unresolved}</span>
                <MeterBar value={percent(model.unresolvedCount, model.contactCount) ?? 0} />
              </div>
              <div>
                <span>{copy.escalated}</span>
                <MeterBar
                  tone="warning"
                  value={percent(model.escalatedCount, model.contactCount) ?? 0}
                />
              </div>
              <div>
                <span>{copy.deliveryHealth}</span>
                <MeterBar tone="success" value={deliverySuccessRate ?? 0} />
              </div>
            </div>
          </section>

          <section className="admin-reference-columns">
            <article className="admin-reference-panel admin-reference-panel--wide">
              <header>
                <div>
                  <h2>{copy.customerPortfolio}</h2>
                  <p>{copy.customerPortfolioDescription}</p>
                </div>
                <a
                  href={isPlatform ? `${prefix}/platform/management-companies` : `${prefix}/sites`}
                >
                  {copy.viewDetails}
                  <ArrowRightIcon aria-hidden="true" weight="bold" />
                </a>
              </header>
              <div className="admin-reference-list">
                {customerRows.length > 0 ? (
                  customerRows.map((row) => (
                    <a href={row.href} key={row.href}>
                      <span>
                        <strong>{row.name}</strong>
                        <small>{row.secondary}</small>
                      </span>
                      <span>
                        <StatusPill tone={row.tone}>{row.status}</StatusPill>
                        <small>
                          {copy.activeQr} {number.format(row.activeQr)}
                        </small>
                      </span>
                      <MeterBar value={row.progress ?? 0} />
                    </a>
                  ))
                ) : (
                  <p className="admin-reference-empty">{copy.noResponseData}</p>
                )}
              </div>
            </article>

            <article className="admin-reference-panel">
              <header>
                <div>
                  <h2>{copy.actionsTitle}</h2>
                  <p>{copy.actionsDescription}</p>
                </div>
              </header>
              <div className="admin-reference-action-list">
                {quickActions.map((action) => (
                  <a href={action.href} key={action.href}>
                    <span>{action.label}</span>
                    <small>{action.description}</small>
                  </a>
                ))}
              </div>
            </article>
          </section>

          <p className="admin-reference-scope-note">{copy.scopeNotice}</p>
        </section>
      </div>
    </>
  );
}
