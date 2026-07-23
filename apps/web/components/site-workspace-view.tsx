import { ArrowLeft, Bell, Car, QrCode, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { OrganizationStatus, SiteType, SiteWorkspace } from "@taptolk/application";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  SideCard,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import type { AdminSiteWorkspaceCopy } from "../content/admin-site-workspace-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface SiteWorkspaceViewProps {
  batchStatusLabels: Readonly<Record<string, string>>;
  copy: AdminSiteWorkspaceCopy;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: SiteWorkspace;
  siteTypeLabels: Readonly<Record<SiteType, string>>;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
}

type BatchRow = SiteWorkspace["batches"][number] & {
  sequence: number;
};

function headingLine(value: string): readonly [string] {
  return [value];
}

function statusTone(status: OrganizationStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

export function SiteWorkspaceView({
  batchStatusLabels,
  copy,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  siteTypeLabels,
  statusLabels,
}: SiteWorkspaceViewProps) {
  const number = new Intl.NumberFormat(locale);
  const prefix = `/${locale}/admin`;
  const batchRows = model.batches.map((batch, index) => ({
    ...batch,
    sequence: index + 1,
  }));
  const batchColumns = [
    {
      cell: (batch) => (
        <strong>
          {copy.batchRequest} {batch.sequence}
        </strong>
      ),
      header: copy.batchHistory,
      key: "batch",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.quantity),
      header: copy.quantity,
      key: "quantity",
    },
    {
      cell: (batch) => (
        <StatusPill tone="success">{batchStatusLabels[batch.status] ?? copy.status}</StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
  ] satisfies Array<DataTableColumn<BatchRow>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${prefix}/sites`}
      />
      <a className="admin-inline-back" href={`${prefix}/sites`}>
        <ArrowLeft aria-hidden="true" size={15} />
        {copy.allLocations}
      </a>
      <PageHeader
        actions={
          <nav aria-label={copy.locationWorkspace} className="admin-workspace-actions">
            <a href={`${prefix}/qr-inventory?site=${model.id}`}>{copy.qrProduction}</a>
            <a href={`${prefix}/operations?site=${model.id}`}>{copy.operations}</a>
            <a href={`${prefix}/reports?site=${model.id}`}>{copy.reports}</a>
          </nav>
        }
        className="admin-compact-heading admin-compact-heading--workspace"
        description={`${model.managementCompanyName} · ${copy.workspaceDescription}`}
        eyebrow={copy.locationWorkspace}
        lines={headingLine(model.name)}
      />
      <StatStrip className="admin-stat-strip" columns={4}>
        <StatTile
          icon={<QrCode aria-hidden="true" size={24} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
        <StatTile
          icon={<Car aria-hidden="true" size={24} />}
          label={copy.contactRequests}
          value={number.format(model.contactCount)}
        />
        <StatTile
          icon={<WarningCircle aria-hidden="true" size={24} />}
          label={copy.openRequests}
          value={number.format(model.openContactCount)}
        />
        <StatTile
          icon={<Bell aria-hidden="true" size={24} />}
          label={copy.failedNotifications}
          value={number.format(model.failedNotificationCount)}
        />
      </StatStrip>
      <div className="admin-workspace-grid">
        <section className="admin-portfolio-panel">
          <header className="admin-portfolio-panel__header">
            <div>
              <h2>{copy.batchHistory}</h2>
              <p>{copy.batchHistoryDescription}</p>
            </div>
          </header>
          <DataTable
            columns={batchColumns}
            empty={<EmptyState title={copy.noBatches} />}
            getRowKey={(batch) => batch.id}
            rows={batchRows}
          />
        </section>
        <SideCard className="admin-company-identity" title={copy.locationInformation}>
          <p>{copy.workspaceDescription}</p>
          <dl>
            <div>
              <dt>{copy.locationWorkspace}</dt>
              <dd>{model.name}</dd>
            </div>
            <div>
              <dt>{copy.type}</dt>
              <dd>{siteTypeLabels[model.type]}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>
                <StatusPill tone={statusTone(model.status)}>
                  {statusLabels[model.status]}
                </StatusPill>
              </dd>
            </div>
            <div>
              <dt>{copy.capacity}</dt>
              <dd>{number.format(model.contractVehicleLimit)}</dd>
            </div>
            <div>
              <dt>{copy.totalQr}</dt>
              <dd>{number.format(model.totalQrCount)}</dd>
            </div>
            <div>
              <dt>{copy.address}</dt>
              <dd>{model.address ?? copy.noAddress}</dd>
            </div>
          </dl>
        </SideCard>
      </div>
    </>
  );
}
