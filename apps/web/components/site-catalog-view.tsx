import { Funnel, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type {
  OrganizationStatus,
  SiteCatalogPage,
  SiteCatalogQueryState,
  SiteLifecycleAction,
  SiteLifecycleRequestItem,
  SiteLifecycleRequestReadModel,
  SiteType,
} from "@taptolk/application";
import { SITE_CATALOG_PAGE_SIZE_OPTIONS } from "@taptolk/application";
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
import { ConsoleQueryForm } from "./console-query-form";
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
  companyFilter: string;
  clearFilters: string;
  contractLimit: string;
  contractLimitHelp: string;
  contractTitle: string;
  create: string;
  createDescription: string;
  createTitle: string;
  createdAt: string;
  createdFrom: string;
  createdTo: string;
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
  pageSize: string;
  pageSizeOptions: readonly [string, string, string];
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
  search: string;
  applyFilters: string;
  filters: string;
  securityNote: string;
  sort: string;
  sortCreatedAt: string;
  sortName: string;
  sortContractLimit: string;
  direction: string;
  directionAscending: string;
  directionDescending: string;
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

function getSiteQueryParams(query: SiteCatalogQueryState, page?: number): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.managementCompanyId) params.set("company", query.managementCompanyId);
  if (query.siteType) params.set("type", query.siteType);
  if (query.status) params.set("state", query.status);
  if (query.createdFrom) params.set("createdFrom", query.createdFrom);
  if (query.createdTo) params.set("createdTo", query.createdTo);
  if (query.sort !== "createdAt") params.set("sort", query.sort);
  if (query.direction !== "desc") params.set("direction", query.direction);
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  if (page && page > 1) params.set("page", String(page));
  return params;
}

function getPageHref(locale: AppLocale, page: number, query: SiteCatalogQueryState): string {
  const params = getSiteQueryParams(query, page);
  const suffix = params.toString();
  return `/${locale}/admin/sites${suffix ? `?${suffix}` : ""}`;
}

function QueryHiddenFields({ query }: { query: SiteCatalogQueryState }) {
  return (
    <>
      {query.search ? (
        <input id="site-query-search" name="q" type="hidden" value={query.search} />
      ) : null}
      {query.managementCompanyId ? (
        <input
          id="site-query-company"
          name="company"
          type="hidden"
          value={query.managementCompanyId}
        />
      ) : null}
      {query.siteType ? (
        <input id="site-query-type" name="type" type="hidden" value={query.siteType} />
      ) : null}
      {query.status ? (
        <input id="site-query-state" name="state" type="hidden" value={query.status} />
      ) : null}
      {query.createdFrom ? (
        <input
          id="site-query-created-from"
          name="createdFrom"
          type="hidden"
          value={query.createdFrom}
        />
      ) : null}
      {query.createdTo ? (
        <input id="site-query-created-to" name="createdTo" type="hidden" value={query.createdTo} />
      ) : null}
      <input id="site-query-sort" name="sort" type="hidden" value={query.sort} />
      <input id="site-query-direction" name="direction" type="hidden" value={query.direction} />
    </>
  );
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis-leading" | "ellipsis-trailing"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page > 0 && page <= totalPages)
    .sort((left, right) => left - right);
  const result: Array<number | "ellipsis-leading" | "ellipsis-trailing"> = [];
  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage !== undefined && page - previousPage > 1) {
      result.push(index === 1 ? "ellipsis-leading" : "ellipsis-trailing");
    }
    result.push(page);
  });
  return result;
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

      <ConsoleQueryForm aria-label={copy.filters} className="admin-site-catalog-toolbar">
        <div className="admin-site-catalog-toolbar__primary">
          <div className="admin-search-control admin-search-control--catalog">
            <MagnifyingGlass aria-hidden="true" size={17} />
            <label className="sr-only" htmlFor="site-catalog-search">
              {copy.search}
            </label>
            <input
              defaultValue={catalog.query.search ?? ""}
              id="site-catalog-search"
              name="q"
              placeholder={copy.search}
              type="search"
            />
          </div>

          <label className="admin-filter-select" htmlFor="site-catalog-company">
            <Funnel aria-hidden="true" size={16} />
            <span className="sr-only">{copy.companyFilter}</span>
            <select
              defaultValue={catalog.query.managementCompanyId ?? ""}
              id="site-catalog-company"
              name="company"
            >
              <option value="">{copy.companyFilter}</option>
              {catalog.parentOptions.map((parent) => (
                <option key={parent.managementCompanyId} value={parent.managementCompanyId}>
                  {parent.managementCompanyName}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-filter-select" htmlFor="site-catalog-type">
            <span className="sr-only">{copy.type}</span>
            <select defaultValue={catalog.query.siteType ?? ""} id="site-catalog-type" name="type">
              <option value="">{copy.type}</option>
              <option value="APARTMENT">{copy.typeLabels.APARTMENT}</option>
              <option value="OFFICETEL">{copy.typeLabels.OFFICETEL}</option>
              <option value="BUILDING">{copy.typeLabels.BUILDING}</option>
              <option value="OTHER">{copy.typeLabels.OTHER}</option>
            </select>
          </label>

          <label className="admin-filter-select" htmlFor="site-catalog-state">
            <span className="sr-only">{copy.status}</span>
            <select defaultValue={catalog.query.status ?? ""} id="site-catalog-state" name="state">
              <option value="">{copy.status}</option>
              <option value="ACTIVE">{copy.statusLabels.ACTIVE}</option>
              <option value="SUSPENDED">{copy.statusLabels.SUSPENDED}</option>
              <option value="CLOSED">{copy.statusLabels.CLOSED}</option>
            </select>
          </label>
        </div>

        <div className="admin-site-catalog-toolbar__secondary">
          <label className="admin-site-catalog-date" htmlFor="site-catalog-created-from">
            <span>{copy.createdFrom}</span>
            <input
              defaultValue={catalog.query.createdFrom ?? ""}
              id="site-catalog-created-from"
              name="createdFrom"
              type="date"
            />
          </label>
          <label className="admin-site-catalog-date" htmlFor="site-catalog-created-to">
            <span>{copy.createdTo}</span>
            <input
              defaultValue={catalog.query.createdTo ?? ""}
              id="site-catalog-created-to"
              name="createdTo"
              type="date"
            />
          </label>
          <label className="admin-filter-select" htmlFor="site-catalog-sort">
            <span className="sr-only">{copy.sort}</span>
            <select defaultValue={catalog.query.sort} id="site-catalog-sort" name="sort">
              <option value="createdAt">{copy.sortCreatedAt}</option>
              <option value="name">{copy.sortName}</option>
              <option value="contractLimit">{copy.sortContractLimit}</option>
            </select>
          </label>
          <label className="admin-filter-select" htmlFor="site-catalog-direction">
            <span className="sr-only">{copy.direction}</span>
            <select
              defaultValue={catalog.query.direction}
              id="site-catalog-direction"
              name="direction"
            >
              <option value="desc">{copy.directionDescending}</option>
              <option value="asc">{copy.directionAscending}</option>
            </select>
          </label>
          <div className="admin-site-catalog-toolbar__actions">
            <button className="tt-button tt-button--compact" type="submit">
              {copy.applyFilters}
            </button>
            <a
              className="tt-button tt-button--secondary tt-button--compact"
              href={`/${locale}/admin/sites`}
            >
              {copy.clearFilters}
            </a>
          </div>
        </div>
      </ConsoleQueryForm>

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

        <div className="admin-catalog-footer">
          <Pagination
            aria-label={copy.paginationLabel}
            className="admin-pagination--compact"
            next={
              hasNext ? (
                <a href={getPageHref(locale, catalog.page + 1, catalog.query)}>{copy.next}</a>
              ) : null
            }
            pages={getPageNumbers(catalog.page, totalPages).map((page) =>
              typeof page === "string" ? (
                <span aria-hidden="true" key={page}>
                  …
                </span>
              ) : (
                <a
                  aria-current={page === catalog.page ? "page" : undefined}
                  href={getPageHref(locale, page, catalog.query)}
                  key={page}
                >
                  {page}
                </a>
              ),
            )}
            previous={
              hasPrevious ? (
                <a href={getPageHref(locale, catalog.page - 1, catalog.query)}>{copy.previous}</a>
              ) : null
            }
            summary={pageSummary}
          />
          <ConsoleQueryForm aria-label={copy.pageSize} className="admin-catalog-page-size-form">
            <QueryHiddenFields query={catalog.query} />
            <label htmlFor="site-catalog-page-size">
              <span>{copy.pageSize}</span>
              <select
                defaultValue={String(catalog.pageSize)}
                id="site-catalog-page-size"
                name="pageSize"
              >
                {SITE_CATALOG_PAGE_SIZE_OPTIONS.map((option, index) => (
                  <option key={option} value={option}>
                    {copy.pageSizeOptions[index]}
                  </option>
                ))}
              </select>
            </label>
          </ConsoleQueryForm>
        </div>
      </section>
    </>
  );
}
