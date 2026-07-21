import type { OperationsDashboardModel } from "@taptolk/application";
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

interface DashboardAction {
  description: string;
  href: string;
  label: string;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="admin-overview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActionCard({ action }: { action: DashboardAction }) {
  return (
    <a className="admin-overview-action" href={action.href}>
      <span>{action.label}</span>
      <p>{action.description}</p>
      <i aria-hidden="true">→</i>
    </a>
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
  variant,
}: AdminDashboardViewProps) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const prefix = `/${locale}/admin`;
  const titleLines =
    variant === "platform"
      ? ([copy.platformLine1, copy.platformLine2] as const)
      : ([copy.workspaceLine1, copy.workspaceLine2] as const);
  const actions: DashboardAction[] =
    variant === "platform"
      ? [
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
          {
            description: copy.actionRevenueDescription,
            href: `${prefix}/platform/revenue`,
            label: copy.actionRevenue,
          },
          {
            description: copy.actionCustomersDescription,
            href: `${prefix}/platform/tenants`,
            label: copy.actionCustomers,
          },
          ...(canApproveAccounts
            ? [
                {
                  description: copy.actionApprovalsDescription,
                  href: `${prefix}/platform/access`,
                  label: copy.actionApprovals,
                },
              ]
            : []),
        ]
      : [
          {
            description: copy.actionOperationsDescription,
            href: `${prefix}/operations`,
            label: copy.actionOperations,
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
            description: copy.actionReportsDescription,
            href: `${prefix}/reports`,
            label: copy.actionReports,
          },
        ];
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
  const qrActivationRate = percent(model.activeQrCount, Math.max(model.activeQrCount + 100, 1));
  const requestResolutionRate =
    100 - percent(model.unresolvedCount, Math.max(model.contactCount, 1));
  const deliverySuccessRate =
    100 -
    percent(
      model.notificationFailedCount + model.notificationRetryCount,
      Math.max(model.notificationSentCount, 1),
    );
  const healthScore =
    totalSignals === 0
      ? 100
      : Math.max(
          0,
          100 -
            percent(
              model.unresolvedCount + model.escalatedCount + model.notificationFailedCount,
              totalSignals,
            ),
        );
  const portfolioRows = [
    {
      action: copy.actionCustomers,
      health: healthScore,
      href: variant === "platform" ? `${prefix}/platform/tenants` : `${prefix}/sites`,
      locations: number.format(model.siteCount),
      name: copy.customerPortfolio,
      openIssues: number.format(model.unresolvedCount + model.openReportCount),
      qr: qrActivationRate,
      requests: number.format(model.contactCount),
    },
    {
      action: copy.actionQr,
      health: qrActivationRate,
      href: `${prefix}/qr-inventory`,
      locations: number.format(model.siteCount),
      name: copy.actionQr,
      openIssues: number.format(model.completedBatchCount),
      qr: qrActivationRate,
      requests: number.format(model.activeQrCount),
    },
    {
      action: copy.actionOperations,
      health: requestResolutionRate,
      href: `${prefix}/operations`,
      locations: number.format(model.siteCount),
      name: copy.operationFlow,
      openIssues: number.format(model.unresolvedCount + model.escalatedCount),
      qr: deliverySuccessRate,
      requests: number.format(model.contactCount),
    },
  ] as const;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={pathname}
      />

      <section className="admin-overview-hero">
        <div className="admin-overview-hero__copy">
          <p className="eyebrow">
            {variant === "platform" ? copy.platformEyebrow : copy.workspaceEyebrow}
          </p>
          <SemanticHeading className="admin-overview-title" lines={titleLines} />
          <p className="admin-overview-description">
            {variant === "platform" ? copy.platformDescription : copy.workspaceDescription}
          </p>
        </div>
        <dl className="admin-overview-context">
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
      </section>

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
            <table className="admin-command-table">
              <thead>
                <tr>
                  <th scope="col">{copy.tableName}</th>
                  <th scope="col">{copy.tableLocations}</th>
                  <th scope="col">{copy.tableRequests}</th>
                  <th scope="col">{copy.tableQrActivation}</th>
                  <th scope="col">{copy.tableOpenIssues}</th>
                  <th scope="col">{copy.tableHealth}</th>
                  <th scope="col">{copy.tableAction}</th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td>{row.locations}</td>
                    <td>{row.requests}</td>
                    <td>
                      <BarMeter label={copy.activeQr} value={row.qr} />
                    </td>
                    <td>{row.openIssues}</td>
                    <td>
                      <BarMeter
                        label={copy.statusHealthy}
                        tone={row.health >= 80 ? "green" : row.health >= 50 ? "orange" : "red"}
                        value={row.health}
                      />
                    </td>
                    <td>
                      <a href={row.href}>{row.action} →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <section
        className={`admin-overview-attention${attentionItems.length === 0 ? " is-healthy" : ""}`}
        aria-labelledby="attention-title"
      >
        <header>
          <div>
            <span className="admin-overview-status">
              {attentionItems.length === 0 ? copy.statusHealthy : copy.statusAttention}
            </span>
            <h2 id="attention-title">
              {attentionItems.length === 0 ? copy.healthyTitle : copy.attentionTitle}
            </h2>
            <p>
              {attentionItems.length === 0 ? copy.healthyDescription : copy.attentionDescription}
            </p>
          </div>
          <a className="admin-overview-attention__link" href={`${prefix}/operations`}>
            {copy.actionOperations}
            <span aria-hidden="true">→</span>
          </a>
        </header>
        {attentionItems.length > 0 ? (
          <div className="admin-overview-attention__items">
            {attentionItems.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{number.format(item.count)}</strong>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="admin-overview-section" aria-labelledby="workspace-actions-title">
        <header className="admin-overview-section__header">
          <div>
            <h2 id="workspace-actions-title">{copy.actionsTitle}</h2>
            <p>{copy.actionsDescription}</p>
          </div>
        </header>
        <div className="admin-overview-actions admin-overview-actions--compact">
          {actions.map((action) => (
            <ActionCard action={action} key={action.href} />
          ))}
        </div>
      </section>
    </>
  );
}
