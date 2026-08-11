import type {
  OrganizationStatus,
  SiteCatalogPage,
  SiteLifecycleAction,
  SiteLifecycleRequestItem,
  SiteLifecycleRequestReadModel,
  SiteType,
} from "@taptolk/application";
import {
  type AddressFieldLabels,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
} from "@taptolk/ui";
import { createSite } from "../admin/site-actions";
import {
  approveSiteLifecycleRequest,
  rejectSiteLifecycleRequest,
} from "../admin/site-lifecycle-request-actions";
import { DAUM_POSTCODE_SCRIPT_SRC } from "../config/address-search";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { ManagementCompanyAddressSearchField } from "./management-company-address-search-field";

interface SiteCatalogCopy {
  actions: string;
  address: string;
  addressDetail: string;
  addressDetailPlaceholder: string;
  addressHelp: string;
  addressSearch: AddressFieldLabels;
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
  moreActions: string;
  name: string;
  next: string;
  noActiveParent: string;
  notAvailable: string;
  optional: string;
  operationalDescription: string;
  operationalTitle: string;
  page: string;
  paginationLabel: string;
  parent: string;
  previous: string;
  reactivate: string;
  reason: string;
  reasonPlaceholder: string;
  required: string;
  requiredHint: string;
  saveContract: string;
  saveOperational: string;
  securityNote: string;
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
  view: string;
}

function Requirement({ copy, optional = false }: { copy: SiteCatalogCopy; optional?: boolean }) {
  return (
    <span
      className={`admin-field-requirement ${optional ? "" : "admin-field-requirement--required"}`}
    >
      {optional ? copy.optional : copy.required}
    </span>
  );
}

interface SiteCatalogViewProps {
  canCreate: boolean;
  catalog: SiteCatalogPage;
  contractVehicleLimitMin: number;
  contractVehicleLimitMax: number;
  copy: SiteCatalogCopy;
  defaultTimezone: string;
  errorMessage?: string | undefined;
  lifecycleRequests: SiteLifecycleRequestReadModel;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

type SiteRow = SiteCatalogPage["items"][number];

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

function getFormatterLocale(locale: AppLocale): string {
  return locale === "ko" ? "ko-KR" : "en";
}

function getSiteStatusTone(
  status: OrganizationStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "CLOSED") {
    return "danger";
  }

  return "warning";
}

function SiteRowActions({
  copy,
  locale,
  site,
}: {
  copy: SiteCatalogCopy;
  locale: AppLocale;
  site: SiteRow;
}) {
  return (
    <div className="admin-site-row-actions">
      <a className="admin-row-action" href={`/${locale}/admin/sites/${site.id}`}>
        {copy.view}
      </a>
    </div>
  );
}

function SiteRegistrationMenu({
  catalog,
  contractVehicleLimitMin,
  contractVehicleLimitMax,
  copy,
  defaultTimezone,
  locale,
}: {
  catalog: SiteCatalogPage;
  contractVehicleLimitMin: number;
  contractVehicleLimitMax: number;
  copy: SiteCatalogCopy;
  defaultTimezone: string;
  locale: AppLocale;
}) {
  return (
    <details className="admin-site-create-menu">
      <summary className="tt-button">{copy.create}</summary>
      <div className="admin-site-create-menu__body">
        <header>
          <strong>{copy.createTitle}</strong>
          <p>{copy.createDescription}</p>
        </header>
        {catalog.parentOptions.length > 0 ? (
          <form action={createSite} className="admin-tenant-form">
            <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
            <input
              aria-label={copy.timezone}
              name="timezone"
              type="hidden"
              value={defaultTimezone}
            />
            <div className="admin-company-form__guidance">
              <strong>{copy.requiredHint}</strong>
            </div>
            <div className="admin-tenant-field-grid">
              <label className="admin-field" htmlFor="site-create-parent">
                <span className="admin-field-label">
                  {copy.parent}
                  <Requirement copy={copy} />
                </span>
                <select id="site-create-parent" name="parentScope" required>
                  {catalog.parentOptions.map((parent) => (
                    <option
                      key={parent.managementCompanyId}
                      value={`${parent.tenantId}|${parent.managementCompanyId}`}
                    >
                      {parent.managementCompanyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field" htmlFor="site-create-name">
                <span className="admin-field-label">
                  {copy.name}
                  <Requirement copy={copy} />
                </span>
                <input id="site-create-name" maxLength={200} name="name" required />
              </label>
              <label className="admin-field" htmlFor="site-create-type">
                <span className="admin-field-label">
                  {copy.type}
                  <Requirement copy={copy} />
                </span>
                <select id="site-create-type" name="siteType" required>
                  {Object.entries(copy.typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field" htmlFor="site-create-limit">
                <span className="admin-field-label">
                  {copy.contractLimit}
                  <Requirement copy={copy} />
                </span>
                <input
                  defaultValue={contractVehicleLimitMin}
                  id="site-create-limit"
                  max={contractVehicleLimitMax}
                  min={contractVehicleLimitMin}
                  name="contractVehicleLimit"
                  required
                  type="number"
                />
                <small>{copy.contractLimitHelp}</small>
              </label>
              <div className="admin-field admin-company-form__wide-field">
                <span className="admin-field-label">
                  {copy.address}
                  <Requirement copy={copy} />
                </span>
                <ManagementCompanyAddressSearchField
                  detailLabel={copy.addressDetail}
                  detailPlaceholder={copy.addressDetailPlaceholder}
                  detailRequirementLabel={copy.optional}
                  idPrefix="site-create-address"
                  labels={copy.addressSearch}
                  name="address"
                  required
                  scriptSrc={DAUM_POSTCODE_SCRIPT_SRC}
                />
                <small>{copy.addressHelp}</small>
              </div>
            </div>
            <label className="admin-field" htmlFor="site-create-reason">
              <span className="admin-field-label">
                {copy.reason}
                <Requirement copy={copy} />
              </span>
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
      </div>
    </details>
  );
}

export function SiteCatalogView({
  canCreate,
  catalog,
  contractVehicleLimitMin,
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
  const hasRowActions = true;
  const pageSummary = copy.page
    .replace("{current}", String(catalog.page))
    .replace("{total}", String(totalPages));
  const columns: Array<DataTableColumn<SiteRow>> = [
    {
      cell: (site) => (
        <div className="tt-table-entity">
          <a className="admin-row-primary" href={`/${locale}/admin/sites/${site.id}`}>
            {site.name}
          </a>
          <small>
            {site.address ?? copy.notAvailable} · {site.timezone}
          </small>
        </div>
      ),
      header: copy.name,
      key: "name",
    },
    {
      cell: (site) => <strong>{site.managementCompanyName}</strong>,
      header: copy.company,
      key: "company",
    },
    {
      cell: (site) => copy.typeLabels[site.type],
      header: copy.type,
      key: "type",
    },
    {
      align: "right",
      cell: (site) => site.contractVehicleLimit.toLocaleString(getFormatterLocale(locale)),
      header: copy.contractLimit,
      key: "contractLimit",
    },
    {
      cell: (site) => (
        <StatusPill tone={getSiteStatusTone(site.status)}>
          {copy.statusLabels[site.status]}
        </StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      cell: (site) => (
        <time dateTime={site.createdAt}>
          {new Intl.DateTimeFormat(getFormatterLocale(locale), {
            dateStyle: "medium",
          }).format(new Date(site.createdAt))}
        </time>
      ),
      header: copy.createdAt,
      key: "createdAt",
    },
    ...(hasRowActions
      ? [
          {
            cell: (site) => <SiteRowActions copy={copy} locale={locale} site={site} />,
            header: copy.actions,
            key: "actions",
          } satisfies DataTableColumn<SiteRow>,
        ]
      : []),
  ];

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/sites`}
      />

      <PageHeader
        actions={
          canCreate ? (
            <SiteRegistrationMenu
              catalog={catalog}
              contractVehicleLimitMin={contractVehicleLimitMin}
              contractVehicleLimitMax={contractVehicleLimitMax}
              copy={copy}
              defaultTimezone={defaultTimezone}
              locale={locale}
            />
          ) : null
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={copy.titleLines}
      />

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
                    <StatusPill tone="warning">{copy.lifecyclePending}</StatusPill>
                  </header>
                  <dl className="admin-approval-meta">
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
                    <button className="tt-button" type="submit">
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
                      <button className="tt-button tt-button--danger" type="submit">
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

      <section className="console-list-surface" aria-label={copy.paginationLabel}>
        <section aria-live="polite" className="admin-catalog-summary">
          <strong>{copy.total.replace("{count}", String(catalog.total))}</strong>
          <span>{copy.securityNote}</span>
        </section>

        <DataTable
          aria-label={copy.paginationLabel}
          columns={columns}
          empty={<EmptyState description={copy.emptyDescription} title={copy.emptyTitle} />}
          getRowKey={(site) => site.id}
          rows={catalog.items}
        />

        <Pagination
          aria-label={copy.paginationLabel}
          className="admin-catalog-footer"
          next={hasNext ? <a href={getPageHref(locale, catalog.page + 1)}>{copy.next}</a> : null}
          pages={Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return (
              <a
                aria-current={page === catalog.page ? "page" : undefined}
                href={getPageHref(locale, page)}
                key={page}
              >
                {page}
              </a>
            );
          })}
          previous={
            hasPrevious ? <a href={getPageHref(locale, catalog.page - 1)}>{copy.previous}</a> : null
          }
          summary={pageSummary}
        />
      </section>
    </>
  );
}
