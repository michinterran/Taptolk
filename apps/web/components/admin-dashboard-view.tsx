import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
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
            description: copy.actionOperationsDescription,
            href: `${prefix}/operations`,
            label: copy.actionOperations,
          },
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
        <div className="admin-overview-actions">
          {actions.map((action) => (
            <ActionCard action={action} key={action.href} />
          ))}
        </div>
      </section>
    </>
  );
}
