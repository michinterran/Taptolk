import type { ManagementCompanyCatalogPage, OrganizationStatus } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import {
  changeManagementCompanyStatus,
  createManagementCompany,
  updateManagementCompany,
} from "../admin/management-company-actions";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyCopy {
  actions: string;
  back: string;
  businessNumber: string;
  businessNumberHelp: string;
  close: string;
  create: string;
  createDescription: string;
  createTitle: string;
  createdAt: string;
  description: string;
  edit: string;
  editDescription: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  name: string;
  next: string;
  noActiveTenant: string;
  page: string;
  paginationLabel: string;
  previous: string;
  reactivate: string;
  readOnly: string;
  reason: string;
  reasonPlaceholder: string;
  save: string;
  securityNote: string;
  signOut: string;
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  suspend: string;
  tenant: string;
  titleLines: readonly [string, ...string[]];
  total: string;
}

interface ManagementCompanyCatalogViewProps {
  canManage: boolean;
  catalog: ManagementCompanyCatalogPage;
  copy: ManagementCompanyCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/platform/management-companies?page=${page}`;
}

function formatBusinessNumber(value: string | null): string {
  return value && value.length === 10
    ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`
    : "—";
}

function HiddenFields({
  company,
  copy,
  locale,
}: {
  company: ManagementCompanyCatalogPage["items"][number];
  copy: ManagementCompanyCopy;
  locale: AppLocale;
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.name} name="companyId" type="hidden" value={company.id} />
      <input aria-label={copy.tenant} name="tenantId" type="hidden" value={company.tenantId} />
      <input
        aria-label={copy.actions}
        name="expectedVersion"
        type="hidden"
        value={company.version}
      />
    </>
  );
}

export function ManagementCompanyCatalogView({
  canManage,
  catalog,
  copy,
  errorMessage,
  locale,
  statusMessage,
}: ManagementCompanyCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/management-companies`}
      />

      <section className="admin-section-hero">
        <div>
          <a className="admin-back-link" href={`/${locale}/admin/platform`}>
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

      {canManage ? (
        <details className="admin-tenant-create">
          <summary>
            <span>{copy.createTitle}</span>
            <small>{copy.createDescription}</small>
          </summary>
          {catalog.tenantOptions.length > 0 ? (
            <form action={createManagementCompany} className="admin-tenant-form">
              <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
              <div className="admin-tenant-field-grid">
                <label className="admin-field" htmlFor="company-create-tenant">
                  <span>{copy.tenant}</span>
                  <select id="company-create-tenant" name="tenantId" required>
                    {catalog.tenantOptions.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field" htmlFor="company-create-name">
                  <span>{copy.name}</span>
                  <input id="company-create-name" maxLength={200} name="name" required />
                </label>
                <label className="admin-field" htmlFor="company-create-business-number">
                  <span>{copy.businessNumber}</span>
                  <input
                    id="company-create-business-number"
                    inputMode="numeric"
                    name="businessNumber"
                    pattern="[0-9-]*"
                  />
                  <small>{copy.businessNumberHelp}</small>
                </label>
              </div>
              <label className="admin-field" htmlFor="company-create-reason">
                <span>{copy.reason}</span>
                <textarea
                  id="company-create-reason"
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
            <p className="admin-catalog-read-only">{copy.noActiveTenant}</p>
          )}
        </details>
      ) : (
        <p className="admin-catalog-read-only">{copy.readOnly}</p>
      )}

      <section className="admin-catalog-summary" aria-live="polite">
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
                <th scope="col">{copy.tenant}</th>
                <th scope="col">{copy.businessNumber}</th>
                <th scope="col">{copy.status}</th>
                <th scope="col">{copy.createdAt}</th>
                {canManage ? <th scope="col">{copy.actions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((company) => {
                const prefix = `company-${company.id}`;
                return (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                    </td>
                    <td>{company.tenantName}</td>
                    <td>
                      <code>{formatBusinessNumber(company.businessNumber)}</code>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge admin-status-badge--${company.status.toLowerCase()}`}
                      >
                        {copy.statusLabels[company.status]}
                      </span>
                    </td>
                    <td>
                      <time dateTime={company.createdAt}>
                        {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
                          dateStyle: "medium",
                        }).format(new Date(company.createdAt))}
                      </time>
                    </td>
                    {canManage ? (
                      <td>
                        {company.status === "CLOSED" ? (
                          <span className="admin-table-closed">{copy.statusLabels.CLOSED}</span>
                        ) : (
                          <details className="admin-tenant-row-actions">
                            <summary>{copy.edit}</summary>
                            <div className="admin-tenant-row-actions__body">
                              <form action={updateManagementCompany} className="admin-tenant-form">
                                <HiddenFields company={company} copy={copy} locale={locale} />
                                <p>{copy.editDescription}</p>
                                <label className="admin-field" htmlFor={`${prefix}-name`}>
                                  <span>{copy.name}</span>
                                  <input
                                    defaultValue={company.name}
                                    id={`${prefix}-name`}
                                    maxLength={200}
                                    name="name"
                                    required
                                  />
                                </label>
                                <label
                                  className="admin-field"
                                  htmlFor={`${prefix}-business-number`}
                                >
                                  <span>{copy.businessNumber}</span>
                                  <input
                                    defaultValue={formatBusinessNumber(
                                      company.businessNumber,
                                    ).replace("—", "")}
                                    id={`${prefix}-business-number`}
                                    inputMode="numeric"
                                    name="businessNumber"
                                    pattern="[0-9-]*"
                                  />
                                </label>
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
                                  {copy.save}
                                </button>
                              </form>

                              <form
                                action={changeManagementCompanyStatus}
                                className="admin-tenant-status-form"
                              >
                                <HiddenFields company={company} copy={copy} locale={locale} />
                                <input
                                  aria-label={copy.status}
                                  name="currentStatus"
                                  type="hidden"
                                  value={company.status}
                                />
                                <p>{copy.statusDescription}</p>
                                <label className="admin-field" htmlFor={`${prefix}-status-reason`}>
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
                                  {company.status === "ACTIVE" ? (
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
                                  )}
                                  <button
                                    className="tt-button tt-button--compact admin-danger-button"
                                    name="nextStatus"
                                    type="submit"
                                    value="CLOSED"
                                  >
                                    {copy.close}
                                  </button>
                                </div>
                              </form>
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
