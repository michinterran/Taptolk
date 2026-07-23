import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  IdentificationCard,
  QrCode,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type {
  ManagementCompanyWorkspace,
  OrganizationStatus,
  SiteType,
} from "@taptolk/application";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  MeterBar,
  PageHeader,
  SideCard,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import type { AdminCompanyWorkspaceCopy } from "../content/admin-company-workspace-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyWorkspaceViewProps {
  copy: AdminCompanyWorkspaceCopy;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: ManagementCompanyWorkspace;
  siteTypeLabels: Readonly<Record<SiteType, string>>;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
}

type SiteRow = ManagementCompanyWorkspace["sites"][number];

function formatBusinessNumber(value: string | null): string {
  return value?.length === 10 ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}` : "—";
}

function headingLine(value: string): readonly [string] {
  return [value];
}

function statusTone(status: OrganizationStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

export function ManagementCompanyWorkspaceView({
  copy,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  siteTypeLabels,
  statusLabels,
}: ManagementCompanyWorkspaceViewProps) {
  const number = new Intl.NumberFormat(locale);
  const prefix = `/${locale}/admin`;
  const siteColumns = [
    {
      cell: (site) => (
        <span className="tt-table-entity">
          <strong>{site.name}</strong>
          <small>
            {copy.type}: {siteTypeLabels[site.type]}
          </small>
        </span>
      ),
      header: copy.locationName,
      key: "location",
    },
    {
      align: "right",
      cell: (site) => number.format(site.contractVehicleLimit),
      header: copy.capacity,
      key: "capacity",
    },
    {
      align: "right",
      cell: (site) => number.format(site.totalQrCount),
      header: copy.totalQr,
      key: "totalQr",
    },
    {
      cell: (site) => {
        const activation =
          site.totalQrCount > 0 ? Math.round((site.activeQrCount / site.totalQrCount) * 100) : 0;
        return (
          <div className="tt-table-meter">
            <MeterBar value={activation} />
            <span>{activation}%</span>
          </div>
        );
      },
      header: copy.qrActivation,
      key: "activation",
    },
    {
      align: "right",
      cell: (site) => number.format(site.batchCount),
      header: copy.batches,
      key: "batches",
    },
    {
      cell: (site) => (
        <StatusPill tone={statusTone(site.status)}>{statusLabels[site.status]}</StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (site) => (
        <a className="admin-row-primary" href={`${prefix}/sites/${site.id}`}>
          {copy.viewLocation}
          <ArrowRight aria-hidden="true" size={15} />
        </a>
      ),
      header: <span className="sr-only">{copy.viewLocation}</span>,
      key: "actions",
    },
  ] satisfies Array<DataTableColumn<SiteRow>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${prefix}/platform/management-companies`}
      />
      <a className="admin-inline-back" href={`${prefix}/platform/management-companies`}>
        <ArrowLeft aria-hidden="true" size={15} />
        {copy.allCompanies}
      </a>
      <PageHeader
        actions={
          <nav aria-label={copy.companyWorkspace} className="admin-workspace-actions">
            <a href={`${prefix}/qr-inventory?company=${model.id}`}>{copy.manageQr}</a>
            <a href={`${prefix}/operations?company=${model.id}`}>{copy.operations}</a>
            <a href={`${prefix}/reports?company=${model.id}`}>{copy.reports}</a>
            <a href={`${prefix}/platform/access?company=${model.id}`}>{copy.manageAccounts}</a>
          </nav>
        }
        className="admin-compact-heading admin-compact-heading--workspace"
        description={copy.workspaceDescription}
        eyebrow={copy.companyWorkspace}
        lines={headingLine(model.name)}
      />

      <StatStrip className="admin-stat-strip admin-stat-strip--workspace" columns={4}>
        <StatTile
          icon={<Buildings aria-hidden="true" size={24} />}
          label={copy.locations}
          value={number.format(model.sites.length)}
        />
        <StatTile
          icon={<QrCode aria-hidden="true" size={24} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
        <StatTile
          icon={<IdentificationCard aria-hidden="true" size={24} />}
          label={copy.activeContracts}
          value={number.format(model.activeContractCount)}
        />
        <StatTile
          icon={<UsersThree aria-hidden="true" size={24} />}
          label={copy.administrators}
          value={number.format(model.adminCount)}
        />
      </StatStrip>

      <div className="admin-workspace-grid">
        <section className="admin-portfolio-panel admin-workspace-locations">
          <header className="admin-portfolio-panel__header">
            <div>
              <h2>{copy.locationHealth}</h2>
              <p>{copy.workspaceDescription}</p>
            </div>
          </header>
          <DataTable
            columns={siteColumns}
            empty={<EmptyState title={copy.noLocations} />}
            getRowKey={(site) => site.id}
            rows={model.sites}
          />
        </section>

        <SideCard className="admin-company-identity" title={copy.companyInformation}>
          <p>{copy.companyInformationDescription}</p>
          <dl>
            <div>
              <dt>{copy.companyWorkspace}</dt>
              <dd>{model.name}</dd>
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
              <dt>{copy.businessNumber}</dt>
              <dd>{formatBusinessNumber(model.businessNumber)}</dd>
            </div>
          </dl>
          <p>{copy.scopeNote}</p>
        </SideCard>
      </div>
    </>
  );
}
