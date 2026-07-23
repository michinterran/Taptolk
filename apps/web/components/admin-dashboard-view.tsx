import {
  BuildingsIcon,
  CarIcon,
  CheckCircleIcon,
  MapPinAreaIcon,
  QrCodeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ManagementCompanyCatalogItem, OperationsDashboardModel } from "@taptolk/application";
import {
  DataTable,
  MeterBar,
  PageHeader,
  SideCard,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
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

const EMPTY_VALUE = "—";

/** Returns null when there is no basis to divide by, so callers render an em dash
    rather than a manufactured 0% or 100%. */
function percent(part: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function AdminDashboardView({
  canApproveAccounts,
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
    variant === "platform" ? ([copy.platformLine1] as const) : ([copy.workspaceLine1] as const);
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
  const totalSignals =
    model.contactCount +
    model.unresolvedCount +
    model.escalatedCount +
    model.notificationFailedCount +
    model.openReportCount;
  const deliveryFailureRate = percent(
    model.notificationFailedCount + model.notificationRetryCount,
    model.notificationSentCount,
  );
  const deliverySuccessRate = deliveryFailureRate === null ? null : 100 - deliveryFailureRate;
  const platformVehicleCapacity = companyPortfolio.reduce(
    (total, company) => total + company.contractVehicleLimit,
    0,
  );
  const metrics =
    variant === "platform"
      ? [
          {
            icon: <BuildingsIcon aria-hidden="true" weight="duotone" />,
            label: copy.company,
            value: number.format(companyPortfolio.length),
          },
          {
            icon: <MapPinAreaIcon aria-hidden="true" weight="duotone" />,
            label: copy.siteCount,
            value: number.format(model.siteCount),
          },
          {
            icon: <CarIcon aria-hidden="true" weight="duotone" />,
            label: copy.contractCapacity,
            value: number.format(platformVehicleCapacity),
          },
          {
            icon: <QrCodeIcon aria-hidden="true" weight="duotone" />,
            label: copy.activeQr,
            value: number.format(model.activeQrCount),
          },
          {
            icon: <WarningCircleIcon aria-hidden="true" weight="duotone" />,
            label: copy.unresolved,
            value: number.format(model.unresolvedCount),
          },
          {
            icon: <CheckCircleIcon aria-hidden="true" weight="duotone" />,
            label: copy.deliveryHealth,
            value: deliverySuccessRate === null ? EMPTY_VALUE : `${deliverySuccessRate}%`,
          },
        ]
      : [
          {
            icon: <MapPinAreaIcon aria-hidden="true" weight="duotone" />,
            label: copy.siteCount,
            value: number.format(model.siteCount),
          },
          {
            icon: <QrCodeIcon aria-hidden="true" weight="duotone" />,
            label: copy.activeQr,
            value: number.format(model.activeQrCount),
          },
          {
            icon: <CarIcon aria-hidden="true" weight="duotone" />,
            label: copy.contactCount,
            value: number.format(model.contactCount),
          },
          {
            icon: <WarningCircleIcon aria-hidden="true" weight="duotone" />,
            label: copy.unresolved,
            value: number.format(model.unresolvedCount),
          },
          {
            icon: <BuildingsIcon aria-hidden="true" weight="duotone" />,
            label: copy.batches,
            value: number.format(model.completedBatchCount),
          },
          {
            icon: <CheckCircleIcon aria-hidden="true" weight="duotone" />,
            label: copy.medianResponse,
            value: responseValue,
          },
        ];
  const customerRows = model.sitePerformance.map((site) => ({
    activeQr: site.activeQrCount,
    contactCount: site.contactCount,
    href: `${prefix}/sites/${site.siteId}`,
    name: site.siteName,
    unresolvedCount: site.unresolvedCount,
  }));
  const platformColumns = [
    {
      cell: (company: ManagementCompanyCatalogItem) => company.name,
      header: copy.company,
      key: "company",
    },
    {
      align: "right" as const,
      cell: (company: ManagementCompanyCatalogItem) => number.format(company.siteCount),
      header: copy.tableLocations,
      key: "locations",
    },
    {
      align: "right" as const,
      cell: (company: ManagementCompanyCatalogItem) => number.format(company.contractVehicleLimit),
      header: copy.contractCapacity,
      key: "capacity",
    },
    {
      align: "right" as const,
      cell: (company: ManagementCompanyCatalogItem) => number.format(company.activeQrCount),
      header: copy.activeQr,
      key: "activeQr",
    },
    {
      cell: (company: ManagementCompanyCatalogItem) => {
        const rate = percent(company.activeQrCount, company.contractVehicleLimit);
        if (rate === null) {
          return EMPTY_VALUE;
        }
        return (
          <div className="admin-command-meter">
            <div>
              <span>{copy.activationRate}</span>
              <strong>{rate}%</strong>
            </div>
            <MeterBar value={rate} />
          </div>
        );
      },
      header: copy.activationRate,
      key: "activation",
    },
    {
      cell: (company: ManagementCompanyCatalogItem) => (
        <StatusPill tone={company.status === "ACTIVE" ? "success" : "warning"}>
          {company.status === "ACTIVE" ? copy.statusHealthy : copy.statusAttention}
        </StatusPill>
      ),
      header: copy.tableHealth,
      key: "status",
    },
    {
      cell: (company: ManagementCompanyCatalogItem) => (
        <a href={`${prefix}/platform/management-companies/${company.id}`}>{copy.viewDetails}</a>
      ),
      header: copy.tableAction,
      key: "action",
    },
  ];
  const customerColumns = [
    {
      cell: (row: (typeof customerRows)[number]) => row.name,
      header: copy.tableName,
      key: "name",
    },
    {
      align: "right" as const,
      cell: (row: (typeof customerRows)[number]) => number.format(row.contactCount),
      header: copy.tableRequests,
      key: "requests",
    },
    {
      align: "right" as const,
      cell: (row: (typeof customerRows)[number]) => number.format(row.activeQr),
      header: copy.activeQr,
      key: "activeQr",
    },
    {
      align: "right" as const,
      cell: (row: (typeof customerRows)[number]) => number.format(row.unresolvedCount),
      header: copy.tableOpenIssues,
      key: "openIssues",
    },
    {
      cell: (row: (typeof customerRows)[number]) => <a href={row.href}>{copy.viewDetails}</a>,
      header: copy.tableAction,
      key: "action",
    },
  ];

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={pathname}
      />

      <PageHeader
        actions={
          <a className="admin-dashboard-refresh" href={pathname}>
            {copy.refreshData}
          </a>
        }
        description={variant === "platform" ? copy.platformDescription : copy.workspaceDescription}
        eyebrow={variant === "platform" ? copy.platformEyebrow : copy.workspaceEyebrow}
        lines={titleLines}
      />

      <SideCard className="admin-overview-section" title={copy.overviewTitle}>
        <p>{copy.overviewDescription}</p>
        <p className="admin-overview-freshness">
          {copy.freshAt}:{" "}
          <time dateTime={model.freshAt}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(model.freshAt))}
          </time>
        </p>
        <StatStrip>
          {metrics.map((metric) => (
            <StatTile key={metric.label} {...metric} />
          ))}
        </StatStrip>
        <p className="admin-overview-scope-note">{copy.scopeNotice}</p>
      </SideCard>

      <section className="admin-command-grid" aria-labelledby="portfolio-title">
        <SideCard
          className="admin-command-panel admin-command-panel--wide"
          title={copy.customerPortfolioTitle}
        >
          <p className="eyebrow">{copy.customerPortfolio}</p>
          <p>{copy.customerPortfolioDescription}</p>
          {variant === "platform" ? (
            <DataTable
              columns={platformColumns}
              getRowKey={(company) => company.id}
              rows={companyPortfolio}
            />
          ) : (
            <DataTable
              columns={customerColumns}
              getRowKey={(row) => row.name}
              rows={customerRows}
            />
          )}
        </SideCard>

        <SideCard
          className="admin-command-panel admin-command-panel--queue"
          title={copy.approvalQueue}
        >
          <p className="eyebrow">{copy.actionsTitle}</p>
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
        </SideCard>
      </section>

      <section
        className="admin-command-grid admin-command-grid--charts"
        aria-label={copy.actionReports}
      >
        <SideCard className="admin-command-panel" title={copy.operationFlow}>
          <p className="eyebrow">{copy.operationFlow}</p>
          <p>{copy.operationFlowDescription}</p>
          <div className="admin-command-bars">
            <MeterBar value={percent(model.unresolvedCount, model.contactCount) ?? 0} />
            <MeterBar
              tone="warning"
              value={percent(model.escalatedCount, model.contactCount) ?? 0}
            />
            <MeterBar
              tone="danger"
              value={percent(model.notificationFailedCount, model.notificationSentCount) ?? 0}
            />
          </div>
        </SideCard>
        <SideCard className="admin-command-panel" title={copy.deliveryHealth}>
          <p className="eyebrow">{copy.deliveryHealth}</p>
          <p>{copy.deliveryHealthDescription}</p>
          <div className="admin-command-bars">
            <MeterBar tone="success" value={deliverySuccessRate ?? 0} />
            <MeterBar
              tone="danger"
              value={percent(model.notificationFailedCount, model.notificationSentCount) ?? 0}
            />
            <MeterBar tone="warning" value={percent(model.openReportCount, totalSignals) ?? 0} />
          </div>
        </SideCard>
        <SideCard className="admin-command-panel" title={copy.locationHierarchy}>
          <p className="eyebrow">{copy.locationHierarchy}</p>
          <p>{copy.locationHierarchyDescription}</p>
          <div className="admin-command-hierarchy admin-command-hierarchy--two" aria-hidden="true">
            <span>{copy.actionManagementCompanies}</span>
            <i />
            <span>{copy.actionSites}</span>
          </div>
        </SideCard>
      </section>
    </>
  );
}
