import type { ManagementCompanyCatalogItem, OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties } from "react";
import type { AdminOverviewCopy } from "../content/admin-overview-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

type DashboardVariant = "customer" | "platform";

interface DashboardContext {
  contextLabel: string;
  contextValue: string;
  roleLabel: string;
  roleTitle: string;
  securityLabel: string;
  securityValue: string;
}

interface AdminDashboardViewProps {
  canApproveAccounts: boolean;
  companyPortfolio?: readonly ManagementCompanyCatalogItem[];
  context: DashboardContext;
  copy: AdminOverviewCopy;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: OperationsDashboardModel;
  pathname: string;
  variant: DashboardVariant;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="admin-overview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function BarMeter({
  label,
  value,
  tone = "violet",
}: {
  label: string;
  tone?: "green" | "orange" | "red" | "violet";
  value: number;
}) {
  return (
    <div className={`admin-command-meter admin-command-meter--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i aria-hidden="true" style={{ "--admin-meter-value": `${value}%` } as CSSProperties} />
    </div>
  );
}

export function AdminDashboardView({
  canApproveAccounts,
  context,
  copy,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  pathname,
  companyPortfolio = [],
  variant,
}: AdminDashboardViewProps) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const prefix = `/${locale}/admin`;
  const titleLines =
    variant === "platform"
      ? ([copy.platformLine1, copy.platformLine2] as const)
      : ([copy.workspaceLine1, copy.workspaceLine2] as const);
  const attentionItems = [
    { count: model.unresolvedCount, label: copy.unresolved },
    { count: model.escalatedCount, label: copy.escalated },
    { count: model.notificationFailedCount, label: copy.failedNotifications },
    { count: model.openReportCount, label: copy.openReports },
  ].filter((item) => item.count > 0);
  const responseValue =
    model.medianOwnerResponseMs === null
      ? copy.noResponseData
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}${copy.seconds}`;
  const metrics = [
    [copy.siteCount, number.format(model.siteCount)],
    [copy.activeQr, number.format(model.activeQrCount)],
    [copy.contactCount, number.format(model.contactCount)],
    [copy.unresolved, number.format(model.unresolvedCount)],
    [copy.medianResponse, responseValue],
    [copy.batches, number.format(model.completedBatchCount)],
    [copy.sentNotifications, number.format(model.notificationSentCount)],
    [copy.openReports, number.format(model.openReportCount)],
  ] as const;
  const totalSignals =
    model.contactCount +
    model.unresolvedCount +
    model.escalatedCount +
    model.notificationFailedCount +
    model.openReportCount;
  const deliverySuccessRate =
    100 -
    percent(
      model.notificationFailedCount + model.notificationRetryCount,
      Math.max(model.notificationSentCount, 1),
    );
  const customerRows = model.sitePerformance.map((site) => ({
    activeQr: site.activeQrCount,
    contactCount: site.contactCount,
    health: 100 - percent(site.unresolvedCount, Math.max(site.contactCount, 1)),
    href: `${prefix}/sites/${site.siteId}`,
    name: site.siteName,
    unresolvedCount: site.unresolvedCount,
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

      <header className="admin-compact-heading admin-overview-heading">
        <div>
          <p className="eyebrow">
            {variant === "platform" ? copy.platformEyebrow : copy.workspaceEyebrow}
          </p>
          <SemanticHeading className="admin-compact-title" lines={titleLines} />
          <p className="admin-overview-description">
            {variant === "platform" ? copy.platformDescription : copy.workspaceDescription}
          </p>
        </div>
        <dl className="admin-heading-context">
          <div>
            <dt>{context.roleTitle}</dt>
            <dd>{context.roleLabel}</dd>
          </div>
          <div>
            <dt>{context.contextLabel}</dt>
            <dd>{context.contextValue}</dd>
          </div>
          <div>
            <dt>{context.securityLabel}</dt>
            <dd>{context.securityValue}</dd>
          </div>
        </dl>
      </header>

      <section className="admin-overview-section" aria-labelledby="operations-overview-title">
        <header className="admin-overview-section__header">
          <div>
            <h2 id="operations-overview-title">{copy.overviewTitle}</h2>
            <p>{copy.overviewDescription}</p>
          </div>
          <p className="admin-overview-freshness">
            {copy.freshAt}:{" "}
            <time dateTime={model.freshAt}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(model.freshAt))}
            </time>
          </p>
        </header>
        <div className="admin-overview-metrics">
          {metrics.map(([label, value]) => (
            <MetricCard key={label} label={label} value={value} />
          ))}
        </div>
        <p className="admin-overview-scope-note">{copy.scopeNotice}</p>
      </section>

      <section className="admin-command-grid" aria-labelledby="portfolio-title">
        <div className="admin-command-panel admin-command-panel--wide">
          <header className="admin-command-panel__header">
            <div>
              <p className="eyebrow">{copy.customerPortfolio}</p>
              <h2 id="portfolio-title">{copy.customerPortfolioTitle}</h2>
              <p>{copy.customerPortfolioDescription}</p>
            </div>
          </header>
          <div className="admin-command-table-wrap">
            {variant === "platform" ? (
              <table className="admin-command-table">
                <thead>
                  <tr>
                    <th scope="col">{copy.company}</th>
                    <th scope="col">{copy.tenant}</th>
                    <th scope="col">{copy.tableLocations}</th>
                    <th scope="col">{copy.contractCapacity}</th>
                    <th scope="col">{copy.activeQr}</th>
                    <th scope="col">{copy.activationRate}</th>
                    <th scope="col">{copy.tableHealth}</th>
                    <th scope="col">{copy.tableAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {companyPortfolio.map((company) => {
                    const rate = percent(company.activeQrCount, company.contractVehicleLimit);
                    return (
                      <tr key={company.id}>
                        <th scope="row">{company.name}</th>
                        <td>{company.tenantName}</td>
                        <td>{number.format(company.siteCount)}</td>
                        <td>{number.format(company.contractVehicleLimit)}</td>
                        <td>{number.format(company.activeQrCount)}</td>
                        <td>
                          <BarMeter label={copy.activationRate} value={rate} />
                        </td>
                        <td>
                          <span
                            className={`admin-health-pill ${company.status === "ACTIVE" ? "is-healthy" : "is-attention"}`}
                          >
                            {company.status === "ACTIVE"
                              ? copy.statusHealthy
                              : copy.statusAttention}
                          </span>
                        </td>
                        <td>
                          <a href={`${prefix}/platform/management-companies/${company.id}`}>
                            {copy.viewDetails} →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="admin-command-table">
                <thead>
                  <tr>
                    <th scope="col">{copy.tableName}</th>
                    <th scope="col">{copy.tableRequests}</th>
                    <th scope="col">{copy.activeQr}</th>
                    <th scope="col">{copy.tableOpenIssues}</th>
                    <th scope="col">{copy.tableHealth}</th>
                    <th scope="col">{copy.tableAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{row.name}</th>
                      <td>{number.format(row.contactCount)}</td>
                      <td>{number.format(row.activeQr)}</td>
                      <td>{number.format(row.unresolvedCount)}</td>
                      <td>
                        <BarMeter
                          label={copy.statusHealthy}
                          tone={row.health >= 80 ? "green" : row.health >= 50 ? "orange" : "red"}
                          value={row.health}
                        />
                      </td>
                      <td>
                        <a href={row.href}>{copy.viewDetails} →</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="admin-command-panel admin-command-panel--queue">
          <p className="eyebrow">{copy.actionsTitle}</p>
          <h2>{copy.approvalQueue}</h2>
          <div className="admin-command-queue">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <a href={`${prefix}/operations`} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{number.format(item.count)}</strong>
                </a>
              ))
            ) : (
              <article className="admin-command-queue__empty">
                <strong>{copy.healthyTitle}</strong>
                <p>{copy.healthyDescription}</p>
              </article>
            )}
            {canApproveAccounts ? (
              <a href={`${prefix}/platform/access`}>
                <span>{copy.actionApprovals}</span>
                <strong>→</strong>
              </a>
            ) : null}
          </div>
        </aside>
      </section>

      <section
        className="admin-command-grid admin-command-grid--charts"
        aria-label={copy.actionReports}
      >
        <article className="admin-command-panel">
          <p className="eyebrow">{copy.operationFlow}</p>
          <h2>{copy.operationFlowDescription}</h2>
          <div className="admin-command-bars">
            <BarMeter
              label={copy.contactCount}
              value={percent(model.contactCount, Math.max(model.contactCount, 1))}
            />
            <BarMeter
              label={copy.unresolved}
              tone="orange"
              value={percent(model.unresolvedCount, Math.max(model.contactCount, 1))}
            />
            <BarMeter
              label={copy.escalated}
              tone="red"
              value={percent(model.escalatedCount, Math.max(model.contactCount, 1))}
            />
          </div>
        </article>
        <article className="admin-command-panel">
          <p className="eyebrow">{copy.deliveryHealth}</p>
          <h2>{copy.deliveryHealthDescription}</h2>
          <div className="admin-command-bars">
            <BarMeter label={copy.sentNotifications} tone="green" value={deliverySuccessRate} />
            <BarMeter
              label={copy.failedNotifications}
              tone="red"
              value={percent(
                model.notificationFailedCount,
                Math.max(model.notificationSentCount, 1),
              )}
            />
            <BarMeter
              label={copy.openReports}
              tone="orange"
              value={percent(model.openReportCount, Math.max(totalSignals, 1))}
            />
          </div>
        </article>
        <article className="admin-command-panel">
          <p className="eyebrow">{copy.locationHierarchy}</p>
          <h2>{copy.locationHierarchyDescription}</h2>
          <div className="admin-command-hierarchy" aria-hidden="true">
            <span>{copy.actionCustomers}</span>
            <i />
            <span>{copy.actionManagementCompanies}</span>
            <i />
            <span>{copy.actionSites}</span>
          </div>
        </article>
      </section>
    </>
  );
}
