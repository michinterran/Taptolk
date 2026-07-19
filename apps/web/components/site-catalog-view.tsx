import type { OrganizationStatus, SiteCatalogPage, SiteType } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import {
  changeSiteStatus,
  createSite,
  updateSiteContract,
  updateSiteOperational,
} from "../admin/site-actions";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface SiteCatalogCopy {
  actions: string;
  address: string;
  back: string;
  close: string;
  company: string;
  contractLimit: string;
  contractLimitHelp: string;
  contractTitle: string;
  create: string;
  createDescription: string;
  createTitle: string;
  createdAt: string;
  description: string;
  edit: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  lifecycleRequestOnly: string;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  name: string;
  next: string;
  noActiveParent: string;
  notAvailable: string;
  operationalDescription: string;
  operationalTitle: string;
  page: string;
  paginationLabel: string;
  parent: string;
  previous: string;
  reactivate: string;
  reason: string;
  reasonPlaceholder: string;
  saveContract: string;
  saveOperational: string;
  securityNote: string;
  signOut: string;
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  suspend: string;
  tenant: string;
  timezone: string;
  titleLines: readonly [string, ...string[]];
  total: string;
  type: string;
  typeLabels: Readonly<Record<SiteType, string>>;
}

interface SiteCatalogViewProps {
  backHref: string;
  canChangeStatus: boolean;
  canClose: boolean;
  canCreate: boolean;
  canUpdateContract: boolean;
  canUpdateOperational: boolean;
  catalog: SiteCatalogPage;
  contractVehicleLimitMax: number;
  copy: SiteCatalogCopy;
  defaultTimezone: string;
  errorMessage?: string | undefined;
  lifecycleRequestOnly: boolean;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/sites?page=${page}`;
}

function SiteHiddenFields({
  copy,
  locale,
  site,
}: {
  copy: SiteCatalogCopy;
  locale: AppLocale;
  site: SiteCatalogPage["items"][number];
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.name} name="siteId" type="hidden" value={site.id} />
      <input aria-label={copy.tenant} name="tenantId" type="hidden" value={site.tenantId} />
      <input
        aria-label={copy.company}
        name="managementCompanyId"
        type="hidden"
        value={site.managementCompanyId}
      />
      <input aria-label={copy.actions} name="expectedVersion" type="hidden" value={site.version} />
    </>
  );
}

export function SiteCatalogView({
  backHref,
  canChangeStatus,
  canClose,
  canCreate,
  canUpdateContract,
  canUpdateOperational,
  catalog,
  contractVehicleLimitMax,
  copy,
  defaultTimezone,
  errorMessage,
  lifecycleRequestOnly,
  locale,
  statusMessage,
}: SiteCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const hasRowActions = canUpdateOperational || canUpdateContract || canChangeStatus || canClose;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/sites`}
      />

      <section className="admin-section-hero">
        <div>
          <a className="admin-back-link" href={backHref}>
            {copy.back}
          </a>
          <p className="eyebrow">{copy.eyebrow}</p>
          <SemanticHeading className="admin-section-title" lines={copy.titleLines} />
          <p className="admin-dashboard-description">{copy.description}</p>
        </div>
        <form action={signOutAdmin}>
          <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
          <button className="tt-button tt-button--secondary" type="submit">
            {copy.signOut}
          </button>
        </form>
      </section>

      {statusMessage ? (
        <aside aria-live="polite" className="admin-notice admin-notice--success">
          <strong>{statusMessage}</strong>
        </aside>
      ) : null}
      {errorMessage ? (
        <aside aria-live="assertive" className="admin-notice admin-notice--danger">
          <strong>{errorMessage}</strong>
        </aside>
      ) : null}
      {lifecycleRequestOnly ? (
        <aside className="admin-notice">
          <strong>{copy.lifecycleRequestOnly}</strong>
        </aside>
      ) : null}

      {canCreate ? (
        <details className="admin-tenant-create">
          <summary>
            <span>{copy.createTitle}</span>
            <small>{copy.createDescription}</small>
          </summary>
          {catalog.parentOptions.length > 0 ? (
            <form action={createSite} className="admin-tenant-form">
              <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
              <div className="admin-tenant-field-grid">
                <label className="admin-field" htmlFor="site-create-parent">
                  <span>{copy.parent}</span>
                  <select id="site-create-parent" name="parentScope" required>
                    {catalog.parentOptions.map((parent) => (
                      <option
                        key={parent.managementCompanyId}
                        value={`${parent.tenantId}|${parent.managementCompanyId}`}
                      >
                        {parent.tenantName} / {parent.managementCompanyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field" htmlFor="site-create-name">
                  <span>{copy.name}</span>
                  <input id="site-create-name" maxLength={200} name="name" required />
                </label>
                <label className="admin-field" htmlFor="site-create-type">
                  <span>{copy.type}</span>
                  <select id="site-create-type" name="siteType" required>
                    {Object.entries(copy.typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field" htmlFor="site-create-timezone">
                  <span>{copy.timezone}</span>
                  <input
                    defaultValue={defaultTimezone}
                    id="site-create-timezone"
                    maxLength={64}
                    name="timezone"
                    required
                  />
                </label>
                <label className="admin-field" htmlFor="site-create-limit">
                  <span>{copy.contractLimit}</span>
                  <input
                    defaultValue={0}
                    id="site-create-limit"
                    max={contractVehicleLimitMax}
                    min={0}
                    name="contractVehicleLimit"
                    required
                    type="number"
                  />
                  <small>{copy.contractLimitHelp}</small>
                </label>
                <label className="admin-field" htmlFor="site-create-address">
                  <span>{copy.address}</span>
                  <input id="site-create-address" maxLength={500} name="address" />
                </label>
              </div>
              <label className="admin-field" htmlFor="site-create-reason">
                <span>{copy.reason}</span>
                <textarea
                  id="site-create-reason"
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder={copy.reasonPlaceholder}
                  required
                />
              </label>
              <button className="tt-button" type="submit">
                {copy.create}
              </button>
            </form>
          ) : (
            <p className="admin-catalog-read-only">{copy.noActiveParent}</p>
          )}
        </details>
      ) : null}

      <section aria-live="polite" className="admin-catalog-summary">
        <strong>{copy.total.replace("{count}", String(catalog.total))}</strong>
        <span>{copy.securityNote}</span>
      </section>

      {catalog.items.length === 0 ? (
        <section className="admin-catalog-empty">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyDescription}</p>
        </section>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th scope="col">{copy.name}</th>
                <th scope="col">{copy.company}</th>
                <th scope="col">{copy.type}</th>
                <th scope="col">{copy.contractLimit}</th>
                <th scope="col">{copy.status}</th>
                <th scope="col">{copy.createdAt}</th>
                {hasRowActions ? <th scope="col">{copy.actions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((site) => {
                const prefix = `site-${site.id}`;
                const mutable = site.status !== "CLOSED";
                const canRenderLifecycle =
                  mutable && (canChangeStatus || (canClose && site.status !== "CLOSED"));
                return (
                  <tr key={site.id}>
                    <td>
                      <strong>{site.name}</strong>
                      <small className="admin-table-meta">
                        {site.address ?? copy.notAvailable} · {site.timezone}
                      </small>
                    </td>
                    <td>
                      {site.tenantName}
                      <small className="admin-table-meta">{site.managementCompanyName}</small>
                    </td>
                    <td>{copy.typeLabels[site.type]}</td>
                    <td>
                      {site.contractVehicleLimit.toLocaleString(locale === "ko" ? "ko-KR" : "en")}
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge admin-status-badge--${site.status.toLowerCase()}`}
                      >
                        {copy.statusLabels[site.status]}
                      </span>
                    </td>
                    <td>
                      <time dateTime={site.createdAt}>
                        {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
                          dateStyle: "medium",
                        }).format(new Date(site.createdAt))}
                      </time>
                    </td>
                    {hasRowActions ? (
                      <td>
                        {!mutable ? (
                          <span className="admin-table-closed">{copy.statusLabels.CLOSED}</span>
                        ) : (
                          <details className="admin-tenant-row-actions">
                            <summary>{copy.edit}</summary>
                            <div className="admin-tenant-row-actions__body">
                              {canUpdateOperational ? (
                                <form action={updateSiteOperational} className="admin-tenant-form">
                                  <SiteHiddenFields copy={copy} locale={locale} site={site} />
                                  <h3>{copy.operationalTitle}</h3>
                                  <p>{copy.operationalDescription}</p>
                                  <div className="admin-tenant-field-grid">
                                    <label className="admin-field" htmlFor={`${prefix}-name`}>
                                      <span>{copy.name}</span>
                                      <input
                                        defaultValue={site.name}
                                        id={`${prefix}-name`}
                                        maxLength={200}
                                        name="name"
                                        required
                                      />
                                    </label>
                                    <label className="admin-field" htmlFor={`${prefix}-type`}>
                                      <span>{copy.type}</span>
                                      <select
                                        defaultValue={site.type}
                                        id={`${prefix}-type`}
                                        name="siteType"
                                        required
                                      >
                                        {Object.entries(copy.typeLabels).map(([value, label]) => (
                                          <option key={value} value={value}>
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="admin-field" htmlFor={`${prefix}-timezone`}>
                                      <span>{copy.timezone}</span>
                                      <input
                                        defaultValue={site.timezone}
                                        id={`${prefix}-timezone`}
                                        maxLength={64}
                                        name="timezone"
                                        required
                                      />
                                    </label>
                                    <label className="admin-field" htmlFor={`${prefix}-address`}>
                                      <span>{copy.address}</span>
                                      <input
                                        defaultValue={site.address ?? ""}
                                        id={`${prefix}-address`}
                                        maxLength={500}
                                        name="address"
                                      />
                                    </label>
                                  </div>
                                  <label className="admin-field" htmlFor={`${prefix}-edit-reason`}>
                                    <span>{copy.reason}</span>
                                    <textarea
                                      id={`${prefix}-edit-reason`}
                                      maxLength={500}
                                      minLength={3}
                                      name="reason"
                                      placeholder={copy.reasonPlaceholder}
                                      required
                                    />
                                  </label>
                                  <button className="tt-button tt-button--compact" type="submit">
                                    {copy.saveOperational}
                                  </button>
                                </form>
                              ) : null}

                              {canUpdateContract ? (
                                <form action={updateSiteContract} className="admin-tenant-form">
                                  <SiteHiddenFields copy={copy} locale={locale} site={site} />
                                  <h3>{copy.contractTitle}</h3>
                                  <label className="admin-field" htmlFor={`${prefix}-limit`}>
                                    <span>{copy.contractLimit}</span>
                                    <input
                                      defaultValue={site.contractVehicleLimit}
                                      id={`${prefix}-limit`}
                                      max={contractVehicleLimitMax}
                                      min={0}
                                      name="contractVehicleLimit"
                                      required
                                      type="number"
                                    />
                                  </label>
                                  <label
                                    className="admin-field"
                                    htmlFor={`${prefix}-contract-reason`}
                                  >
                                    <span>{copy.reason}</span>
                                    <textarea
                                      id={`${prefix}-contract-reason`}
                                      maxLength={500}
                                      minLength={3}
                                      name="reason"
                                      placeholder={copy.reasonPlaceholder}
                                      required
                                    />
                                  </label>
                                  <button className="tt-button tt-button--compact" type="submit">
                                    {copy.saveContract}
                                  </button>
                                </form>
                              ) : null}

                              {canRenderLifecycle ? (
                                <form
                                  action={changeSiteStatus}
                                  className="admin-tenant-status-form"
                                >
                                  <SiteHiddenFields copy={copy} locale={locale} site={site} />
                                  <input
                                    aria-label={copy.status}
                                    name="currentStatus"
                                    type="hidden"
                                    value={site.status}
                                  />
                                  <p>{copy.statusDescription}</p>
                                  <label
                                    className="admin-field"
                                    htmlFor={`${prefix}-status-reason`}
                                  >
                                    <span>{copy.reason}</span>
                                    <textarea
                                      id={`${prefix}-status-reason`}
                                      maxLength={500}
                                      minLength={3}
                                      name="reason"
                                      placeholder={copy.reasonPlaceholder}
                                      required
                                    />
                                  </label>
                                  <div className="admin-tenant-status-actions">
                                    {canChangeStatus ? (
                                      site.status === "ACTIVE" ? (
                                        <button
                                          className="tt-button tt-button--secondary tt-button--compact"
                                          name="nextStatus"
                                          type="submit"
                                          value="SUSPENDED"
                                        >
                                          {copy.suspend}
                                        </button>
                                      ) : (
                                        <button
                                          className="tt-button tt-button--secondary tt-button--compact"
                                          name="nextStatus"
                                          type="submit"
                                          value="ACTIVE"
                                        >
                                          {copy.reactivate}
                                        </button>
                                      )
                                    ) : null}
                                    {canClose ? (
                                      <button
                                        className="tt-button tt-button--compact admin-danger-button"
                                        name="nextStatus"
                                        type="submit"
                                        value="CLOSED"
                                      >
                                        {copy.close}
                                      </button>
                                    ) : null}
                                  </div>
                                </form>
                              ) : null}
                            </div>
                          </details>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label={copy.paginationLabel} className="admin-pagination">
        {hasPrevious ? (
          <a
            className="tt-button tt-button--secondary"
            href={getPageHref(locale, catalog.page - 1)}
          >
            {copy.previous}
          </a>
        ) : (
          <span />
        )}
        <span>
          {copy.page
            .replace("{current}", String(catalog.page))
            .replace("{total}", String(totalPages))}
        </span>
        {hasNext ? (
          <a
            className="tt-button tt-button--secondary"
            href={getPageHref(locale, catalog.page + 1)}
          >
            {copy.next}
          </a>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
