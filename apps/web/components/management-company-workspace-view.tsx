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

function formatBusinessNumber(value: string | null): string {
  return value?.length === 10 ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}` : "—";
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
  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${prefix}/platform/management-companies`}
      />
      <section className="admin-compact-heading admin-compact-heading--workspace">
        <div>
          <a className="admin-inline-back" href={`${prefix}/platform/management-companies`}>
            <ArrowLeft aria-hidden="true" size={15} />
            {copy.allCompanies}
          </a>
          <p className="eyebrow">{copy.companyWorkspace}</p>
          <h1>{model.name}</h1>
          <p>{copy.workspaceDescription}</p>
        </div>
        <nav aria-label={copy.companyWorkspace} className="admin-workspace-actions">
          <a href={`${prefix}/qr-inventory?company=${model.id}`}>{copy.manageQr}</a>
          <a href={`${prefix}/operations?company=${model.id}`}>{copy.operations}</a>
          <a href={`${prefix}/reports?company=${model.id}`}>{copy.reports}</a>
          <a href={`${prefix}/platform/access?company=${model.id}`}>{copy.manageAccounts}</a>
        </nav>
      </section>

      <section className="admin-stat-strip admin-stat-strip--workspace">
        <article>
          <Buildings aria-hidden="true" size={24} />
          <span>{copy.locations}</span>
          <strong>{number.format(model.sites.length)}</strong>
        </article>
        <article>
          <QrCode aria-hidden="true" size={24} />
          <span>{copy.activeQr}</span>
          <strong>{number.format(model.activeQrCount)}</strong>
        </article>
        <article>
          <IdentificationCard aria-hidden="true" size={24} />
          <span>{copy.activeContracts}</span>
          <strong>{number.format(model.activeContractCount)}</strong>
        </article>
        <article>
          <UsersThree aria-hidden="true" size={24} />
          <span>{copy.administrators}</span>
          <strong>{number.format(model.adminCount)}</strong>
        </article>
      </section>

      <div className="admin-workspace-grid">
        <section className="admin-portfolio-panel admin-workspace-locations">
          <header className="admin-portfolio-panel__header">
            <div>
              <h2>{copy.locationHealth}</h2>
              <p>{copy.workspaceDescription}</p>
            </div>
          </header>
          {model.sites.length === 0 ? (
            <p className="admin-workspace-empty">{copy.noLocations}</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-data-table admin-data-table--portfolio">
                <thead>
                  <tr>
                    <th scope="col">{copy.locationName}</th>
                    <th scope="col">{copy.capacity}</th>
                    <th scope="col">{copy.totalQr}</th>
                    <th scope="col">{copy.qrActivation}</th>
                    <th scope="col">{copy.batches}</th>
                    <th scope="col">{copy.status}</th>
                    <th scope="col">
                      <span className="sr-only">{copy.viewLocation}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.sites.map((site) => {
                    const activation =
                      site.totalQrCount > 0
                        ? Math.round((site.activeQrCount / site.totalQrCount) * 100)
                        : 0;
                    return (
                      <tr key={site.id}>
                        <th scope="row">
                          <strong>{site.name}</strong>
                          <small>
                            {copy.type}: {siteTypeLabels[site.type]}
                          </small>
                        </th>
                        <td>{number.format(site.contractVehicleLimit)}</td>
                        <td>{number.format(site.totalQrCount)}</td>
                        <td>
                          <div className="admin-progress-cell">
                            <progress max={100} value={activation}>
                              {activation}%
                            </progress>
                            <span>{activation}%</span>
                          </div>
                        </td>
                        <td>{number.format(site.batchCount)}</td>
                        <td>
                          <span
                            className={`admin-health-pill ${site.status === "ACTIVE" ? "is-healthy" : "is-attention"}`}
                          >
                            {statusLabels[site.status]}
                          </span>
                        </td>
                        <td>
                          <a className="admin-row-primary" href={`${prefix}/sites/${site.id}`}>
                            {copy.viewLocation}
                            <ArrowRight aria-hidden="true" size={15} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-company-identity">
          <header>
            <h2>{copy.companyInformation}</h2>
            <p>{copy.companyInformationDescription}</p>
          </header>
          <dl>
            <div>
              <dt>{copy.companyWorkspace}</dt>
              <dd>{model.name}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>{statusLabels[model.status]}</dd>
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
        </aside>
      </div>
    </>
  );
}
