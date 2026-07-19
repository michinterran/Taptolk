import type { TenantCatalogPage, TenantStatus } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import { changeTenantStatus, createTenant, updateTenant } from "../admin/tenant-management-actions";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface TenantCatalogCopy {
  actions: string;
  back: string;
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
  page: string;
  paginationLabel: string;
  previous: string;
  reactivate: string;
  reason: string;
  reasonPlaceholder: string;
  readOnly: string;
  save: string;
  securityNote: string;
  signOut: string;
  slug: string;
  slugHelp: string;
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<TenantStatus, string>>;
  suspend: string;
  titleLines: readonly [string, ...string[]];
  total: string;
}

interface TenantCatalogViewProps {
  canManage: boolean;
  catalog: TenantCatalogPage;
  copy: TenantCatalogCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/platform/tenants?page=${page}`;
}

function HiddenCommandFields({
  copy,
  locale,
  tenant,
}: {
  copy: TenantCatalogCopy;
  locale: AppLocale;
  tenant: TenantCatalogPage["items"][number];
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.name} name="tenantId" type="hidden" value={tenant.id} />
      <input
        aria-label={copy.actions}
        name="expectedVersion"
        type="hidden"
        value={tenant.version}
      />
    </>
  );
}

export function TenantCatalogView({
  canManage,
  catalog,
  copy,
  errorMessage,
  locale,
  statusMessage,
}: TenantCatalogViewProps) {
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
        pathname={`/${locale}/admin/platform/tenants`}
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
          <form action={createTenant} className="admin-tenant-form">
            <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
            <div className="admin-tenant-field-grid">
              <label className="admin-field" htmlFor="tenant-create-name">
                <span>{copy.name}</span>
                <input id="tenant-create-name" maxLength={200} name="name" required />
              </label>
              <label className="admin-field" htmlFor="tenant-create-slug">
                <span>{copy.slug}</span>
                <input
                  id="tenant-create-slug"
                  maxLength={63}
                  minLength={2}
                  name="slug"
                  pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                  required
                />
                <small>{copy.slugHelp}</small>
              </label>
            </div>
            <label className="admin-field" htmlFor="tenant-create-reason">
              <span>{copy.reason}</span>
              <textarea
                id="tenant-create-reason"
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
                <th scope="col">{copy.slug}</th>
                <th scope="col">{copy.status}</th>
                <th scope="col">{copy.createdAt}</th>
                {canManage ? <th scope="col">{copy.actions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((tenant) => {
                const fieldPrefix = `tenant-${tenant.id}`;
                return (
                  <tr key={tenant.id}>
                    <td>
                      <strong>{tenant.name}</strong>
                    </td>
                    <td>
                      <code>{tenant.slug}</code>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge admin-status-badge--${tenant.status.toLowerCase()}`}
                      >
                        {copy.statusLabels[tenant.status]}
                      </span>
                    </td>
                    <td>
                      <time dateTime={tenant.createdAt}>
                        {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
                          dateStyle: "medium",
                        }).format(new Date(tenant.createdAt))}
                      </time>
                    </td>
                    {canManage ? (
                      <td>
                        {tenant.status === "CLOSED" ? (
                          <span className="admin-table-closed">{copy.statusLabels.CLOSED}</span>
                        ) : (
                          <details className="admin-tenant-row-actions">
                            <summary>{copy.edit}</summary>
                            <div className="admin-tenant-row-actions__body">
                              <form action={updateTenant} className="admin-tenant-form">
                                <HiddenCommandFields copy={copy} locale={locale} tenant={tenant} />
                                <p>{copy.editDescription}</p>
                                <label className="admin-field" htmlFor={`${fieldPrefix}-name`}>
                                  <span>{copy.name}</span>
                                  <input
                                    defaultValue={tenant.name}
                                    id={`${fieldPrefix}-name`}
                                    maxLength={200}
                                    name="name"
                                    required
                                  />
                                </label>
                                <label className="admin-field" htmlFor={`${fieldPrefix}-slug`}>
                                  <span>{copy.slug}</span>
                                  <input
                                    defaultValue={tenant.slug}
                                    id={`${fieldPrefix}-slug`}
                                    maxLength={63}
                                    minLength={2}
                                    name="slug"
                                    pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                                    required
                                  />
                                </label>
                                <label
                                  className="admin-field"
                                  htmlFor={`${fieldPrefix}-edit-reason`}
                                >
                                  <span>{copy.reason}</span>
                                  <textarea
                                    id={`${fieldPrefix}-edit-reason`}
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
                                action={changeTenantStatus}
                                className="admin-tenant-status-form"
                              >
                                <HiddenCommandFields copy={copy} locale={locale} tenant={tenant} />
                                <input
                                  aria-label={copy.status}
                                  name="currentStatus"
                                  type="hidden"
                                  value={tenant.status}
                                />
                                <p>{copy.statusDescription}</p>
                                <label
                                  className="admin-field"
                                  htmlFor={`${fieldPrefix}-status-reason`}
                                >
                                  <span>{copy.reason}</span>
                                  <textarea
                                    id={`${fieldPrefix}-status-reason`}
                                    maxLength={500}
                                    minLength={3}
                                    name="reason"
                                    placeholder={copy.reasonPlaceholder}
                                    required
                                  />
                                </label>
                                <div className="admin-tenant-status-actions">
                                  {tenant.status === "ACTIVE" ? (
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
