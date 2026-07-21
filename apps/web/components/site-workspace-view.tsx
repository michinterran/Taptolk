import { ArrowLeft, Bell, Car, QrCode, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { OrganizationStatus, SiteType, SiteWorkspace } from "@taptolk/application";
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
  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${prefix}/sites`}
      />
      <section className="admin-compact-heading admin-compact-heading--workspace">
        <div>
          <a className="admin-inline-back" href={`${prefix}/sites`}>
            <ArrowLeft aria-hidden="true" size={15} />
            {copy.allLocations}
          </a>
          <p className="eyebrow">{copy.locationWorkspace}</p>
          <h1>{model.name}</h1>
          <p>
            {model.managementCompanyName} · {copy.workspaceDescription}
          </p>
        </div>
        <nav aria-label={copy.locationWorkspace} className="admin-workspace-actions">
          <a href={`${prefix}/qr-inventory?site=${model.id}`}>{copy.qrProduction}</a>
          <a href={`${prefix}/operations?site=${model.id}`}>{copy.operations}</a>
          <a href={`${prefix}/reports?site=${model.id}`}>{copy.reports}</a>
        </nav>
      </section>
      <section className="admin-stat-strip">
        <article>
          <QrCode aria-hidden="true" size={24} />
          <span>{copy.activeQr}</span>
          <strong>{number.format(model.activeQrCount)}</strong>
        </article>
        <article>
          <Car aria-hidden="true" size={24} />
          <span>{copy.contactRequests}</span>
          <strong>{number.format(model.contactCount)}</strong>
        </article>
        <article>
          <WarningCircle aria-hidden="true" size={24} />
          <span>{copy.openRequests}</span>
          <strong>{number.format(model.openContactCount)}</strong>
        </article>
        <article>
          <Bell aria-hidden="true" size={24} />
          <span>{copy.failedNotifications}</span>
          <strong>{number.format(model.failedNotificationCount)}</strong>
        </article>
      </section>
      <div className="admin-workspace-grid">
        <section className="admin-portfolio-panel">
          <header className="admin-portfolio-panel__header">
            <div>
              <h2>{copy.batchHistory}</h2>
              <p>{copy.batchHistoryDescription}</p>
            </div>
          </header>
          {model.batches.length === 0 ? (
            <p className="admin-workspace-empty">{copy.noBatches}</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-data-table admin-data-table--portfolio">
                <thead>
                  <tr>
                    <th scope="col">{copy.batchHistory}</th>
                    <th scope="col">{copy.quantity}</th>
                    <th scope="col">{copy.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {model.batches.map((batch, index) => (
                    <tr key={batch.id}>
                      <th scope="row">
                        {copy.batchRequest} {index + 1}
                      </th>
                      <td>{number.format(batch.quantity)}</td>
                      <td>
                        <span className="admin-health-pill is-healthy">
                          {batchStatusLabels[batch.status] ?? copy.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="admin-company-identity">
          <header>
            <h2>{copy.locationInformation}</h2>
            <p>{copy.workspaceDescription}</p>
          </header>
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
              <dt>{copy.address}</dt>
              <dd>{model.address ?? copy.noAddress}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
