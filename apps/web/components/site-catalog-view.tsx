import type {
  OrganizationStatus,
  SiteCatalogPage,
  SiteLifecycleAction,
  SiteLifecycleRequestItem,
  SiteLifecycleRequestReadModel,
  SiteType,
} from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import {
  changeSiteStatus,
  createSite,
  updateSiteContract,
  updateSiteOperational,
} from "../admin/site-actions";
import {
  approveSiteLifecycleRequest,
  cancelSiteLifecycleRequest,
  rejectSiteLifecycleRequest,
  requestSiteLifecycle,
} from "../admin/site-lifecycle-request-actions";
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
  lifecycleActionLabels: Readonly<Record<SiteLifecycleAction, string>>;
  lifecycleApprovalApprove: string;
  lifecycleApprovalDescription: string;
  lifecycleApprovalEmpty: string;
  lifecycleApprovalReject: string;
  lifecycleApprovalRejectSummary: string;
  lifecycleApprovalTitle: string;
  lifecycleCancel: string;
  lifecycleCancelDescription: string;
  lifecyclePending: string;
  lifecyclePendingAt: string;
  lifecyclePendingDescription: string;
  lifecycleRequest: string;
  lifecycleRequestDescription: string;
  lifecycleRequestReason: string;
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
  canRequestClose: boolean;
  canRequestStatus: boolean;
  canUpdateContract: boolean;
  canUpdateOperational: boolean;
  catalog: SiteCatalogPage;
  contractVehicleLimitMax: number;
  copy: SiteCatalogCopy;
  defaultTimezone: string;
  errorMessage?: string | undefined;
  lifecycleRequests: SiteLifecycleRequestReadModel;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

function LifecycleRequestHiddenFields({
  copy,
  locale,
  request,
}: {
  copy: SiteCatalogCopy;
  locale: AppLocale;
  request: SiteLifecycleRequestItem;
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.actions} name="action" type="hidden" value={request.action} />
      <input aria-label={copy.actions} name="lifecycleRequestId" type="hidden" value={request.id} />
      <input
        aria-label={copy.actions}
        name="expectedRequestVersion"
        type="hidden"
        value={request.version}
      />
      <input aria-label={copy.tenant} name="tenantId" type="hidden" value={request.tenantId} />
      <input
        aria-label={copy.company}
        name="managementCompanyId"
        type="hidden"
        value={request.managementCompanyId}
      />
      <input aria-label={copy.name} name="siteId" type="hidden" value={request.siteId} />
      <input
        aria-label={copy.lifecyclePending}
        name="requestedBy"
        type="hidden"
        value={request.requestedBy}
      />
    </>
  );
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
  canRequestClose,
  canRequestStatus,
  canUpdateContract,
  canUpdateOperational,
  catalog,
  contractVehicleLimitMax,
  copy,
  defaultTimezone,
  errorMessage,
  lifecycleRequests,
  locale,
  statusMessage,
}: SiteCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const hasRowActions =
    canUpdateOperational ||
    canUpdateContract ||
    canChangeStatus ||
    canClose ||
    canRequestStatus ||
    canRequestClose ||
    lifecycleRequests.pendingBySiteId.size > 0;

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
      {canRequestStatus || canRequestClose ? (
        <aside className="admin-notice">
          <strong>{copy.lifecycleRequestOnly}</strong>
        </aside>
      ) : null}

      {lifecycleRequests.approvalQueue.length > 0 ? (
        <section aria-labelledby="site-lifecycle-approval-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="site-lifecycle-approval-title">{copy.lifecycleApprovalTitle}</h2>
            <p>{copy.lifecycleApprovalDescription}</p>
          </header>
          <div className="admin-approval-list">
            {lifecycleRequests.approvalQueue.map((request) => {
              const prefix = `lifecycle-review-${request.id}`;
              return (
                <article className="admin-approval-card" key={request.id}>
                  <header className="admin-approval-card__header">
                    <div>
                      <span className="admin-approval-card__label">
                        {copy.lifecycleActionLabels[request.action]}
                      </span>
                      <h3>{request.siteName}</h3>
                    </div>
                    <span className="admin-status-badge admin-status-badge--suspended">
                      {copy.lifecyclePending}
                    </span>
                  </header>
                  <dl className="admin-approval-meta">
                    <div>
                      <dt>{copy.tenant}</dt>
                      <dd>{request.tenantName}</dd>
                    </div>
                    <div>
                      <dt>{copy.company}</dt>
                      <dd>{request.managementCompanyName}</dd>
                    </div>
                    <div>
                      <dt>{copy.lifecycleRequestReason}</dt>
                      <dd>{request.reason}</dd>
                    </div>
                  </dl>
                  <form action={approveSiteLifecycleRequest} className="admin-approval-form">
                    <LifecycleRequestHiddenFields copy={copy} locale={locale} request={request} />
                    <label className="admin-field" htmlFor={`${prefix}-approve-reason`}>
                      <span>{copy.reason}</span>
                      <textarea
                        id={`${prefix}-approve-reason`}
                        maxLength={500}
                        minLength={3}
                        name="reason"
                        placeholder={copy.reasonPlaceholder}
                        required
                      />
                    </label>
                    <button className="tt-button admin-approval-primary-action" type="submit">
                      {copy.lifecycleApprovalApprove}
                    </button>
                  </form>
                  <details className="admin-rejection-panel">
                    <summary>{copy.lifecycleApprovalRejectSummary}</summary>
                    <form action={rejectSiteLifecycleRequest} className="admin-rejection-form">
                      <LifecycleRequestHiddenFields copy={copy} locale={locale} request={request} />
                      <label className="admin-field" htmlFor={`${prefix}-reject-reason`}>
                        <span>{copy.reason}</span>
                        <textarea
                          id={`${prefix}-reject-reason`}
                          maxLength={500}
                          minLength={3}
                          name="reason"
                          placeholder={copy.reasonPlaceholder}
                          required
                        />
                      </label>
                      <button className="tt-button admin-danger-action" type="submit">
                        {copy.lifecycleApprovalReject}
                      </button>
                    </form>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
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
                const pendingRequest = lifecycleRequests.pendingBySiteId.get(site.id);
                const canRenderLifecycle =
                  mutable && (canChangeStatus || (canClose && site.status !== "CLOSED"));
                const canRenderLifecycleRequest =
                  mutable && !pendingRequest && (canRequestStatus || canRequestClose);
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

                              {pendingRequest ? (
                                <section
                                  aria-label={copy.lifecyclePending}
                                  className="admin-lifecycle-pending"
                                >
                                  <h3>{copy.lifecyclePending}</h3>
                                  <p>
                                    {copy.lifecyclePendingDescription.replace(
                                      "{action}",
                                      copy.lifecycleActionLabels[pendingRequest.action],
                                    )}
                                  </p>
                                  <p>
                                    {copy.lifecyclePendingAt.replace(
                                      "{date}",
                                      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      }).format(new Date(pendingRequest.createdAt)),
                                    )}
                                  </p>
                                  {lifecycleRequests.cancellableRequestIds.has(
                                    pendingRequest.id,
                                  ) ? (
                                    <form
                                      action={cancelSiteLifecycleRequest}
                                      className="admin-tenant-status-form"
                                    >
                                      <LifecycleRequestHiddenFields
                                        copy={copy}
                                        locale={locale}
                                        request={pendingRequest}
                                      />
                                      <label
                                        className="admin-field"
                                        htmlFor={`${prefix}-cancel-reason`}
                                      >
                                        <span>{copy.reason}</span>
                                        <textarea
                                          id={`${prefix}-cancel-reason`}
                                          maxLength={500}
                                          minLength={3}
                                          name="reason"
                                          placeholder={copy.reasonPlaceholder}
                                          required
                                        />
                                      </label>
                                      <button
                                        className="tt-button tt-button--secondary tt-button--compact"
                                        type="submit"
                                      >
                                        {copy.lifecycleCancel}
                                      </button>
                                    </form>
                                  ) : (
                                    <p>{copy.lifecycleCancelDescription}</p>
                                  )}
                                </section>
                              ) : null}

                              {canRenderLifecycleRequest ? (
                                <form
                                  action={requestSiteLifecycle}
                                  className="admin-tenant-status-form"
                                >
                                  <SiteHiddenFields copy={copy} locale={locale} site={site} />
                                  <input
                                    aria-label={copy.status}
                                    name="currentStatus"
                                    type="hidden"
                                    value={site.status}
                                  />
                                  <input
                                    aria-label={copy.actions}
                                    name="expectedSiteVersion"
                                    type="hidden"
                                    value={site.version}
                                  />
                                  <h3>{copy.lifecycleRequest}</h3>
                                  <p>{copy.lifecycleRequestDescription}</p>
                                  <label
                                    className="admin-field"
                                    htmlFor={`${prefix}-request-reason`}
                                  >
                                    <span>{copy.reason}</span>
                                    <textarea
                                      id={`${prefix}-request-reason`}
                                      maxLength={500}
                                      minLength={3}
                                      name="reason"
                                      placeholder={copy.reasonPlaceholder}
                                      required
                                    />
                                  </label>
                                  <div className="admin-tenant-status-actions">
                                    {canRequestStatus ? (
                                      <button
                                        className="tt-button tt-button--secondary tt-button--compact"
                                        name="action"
                                        type="submit"
                                        value={site.status === "ACTIVE" ? "SUSPEND" : "REACTIVATE"}
                                      >
                                        {site.status === "ACTIVE"
                                          ? copy.lifecycleActionLabels.SUSPEND
                                          : copy.lifecycleActionLabels.REACTIVATE}
                                      </button>
                                    ) : null}
                                    {canRequestClose ? (
                                      <button
                                        className="tt-button tt-button--compact admin-danger-button"
                                        name="action"
                                        type="submit"
                                        value="CLOSE"
                                      >
                                        {copy.lifecycleActionLabels.CLOSE}
                                      </button>
                                    ) : null}
                                  </div>
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
