import {
  ArrowRight,
  Buildings,
  DotsThree,
  Funnel,
  MagnifyingGlass,
  Plus,
  QrCode,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { ManagementCompanyCatalogPage, OrganizationStatus } from "@taptolk/application";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import {
  changeManagementCompanyStatus,
  createManagementCompany,
  updateManagementCompany,
} from "../admin/management-company-actions";
import type { AdminCompanyPortfolioCopy } from "../content/admin-company-portfolio-copy";
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
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  suspend: string;
  tenant: string;
  total: string;
}

interface ManagementCompanyCatalogViewProps {
  canManage: boolean;
  catalog: ManagementCompanyCatalogPage;
  copy: ManagementCompanyCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  portfolioCopy: AdminCompanyPortfolioCopy;
  search?: string | undefined;
  stateFilter?: OrganizationStatus | undefined;
  statusMessage?: string | undefined;
}

type CompanyRow = ManagementCompanyCatalogPage["items"][number];

function getPageHref(
  locale: AppLocale,
  page: number,
  search?: string,
  stateFilter?: OrganizationStatus,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  if (stateFilter) params.set("state", stateFilter);
  return `/${locale}/admin/platform/management-companies?${params.toString()}`;
}

function formatBusinessNumber(value: string | null): string {
  return value && value.length === 10
    ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`
    : "—";
}

function headingLine(value: string): readonly [string] {
  return [value];
}

function riskTone(status: OrganizationStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

function HiddenFields({
  company,
  copy,
  locale,
}: {
  company: CompanyRow;
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

function ManagementCompanyCreatePanel({
  catalog,
  copy,
  locale,
}: {
  catalog: ManagementCompanyCatalogPage;
  copy: ManagementCompanyCopy;
  locale: AppLocale;
}) {
  return (
    <details className="admin-toolbar-create">
      <summary>
        <Plus aria-hidden="true" size={16} />
        {copy.createTitle}
      </summary>
      <div className="admin-toolbar-popover">
        <p>{copy.createDescription}</p>
        {catalog.tenantOptions.length > 0 ? (
          <form action={createManagementCompany} className="admin-tenant-form">
            <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
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
            <button className="tt-button tt-button--compact" type="submit">
              {copy.create}
            </button>
          </form>
        ) : (
          <p>{copy.noActiveTenant}</p>
        )}
      </div>
    </details>
  );
}

function ManagementCompanyRowActions({
  canManage,
  company,
  copy,
  locale,
  portfolioCopy,
}: {
  canManage: boolean;
  company: CompanyRow;
  copy: ManagementCompanyCopy;
  locale: AppLocale;
  portfolioCopy: AdminCompanyPortfolioCopy;
}) {
  const prefix = `company-${company.id}`;

  return (
    <div className="admin-row-actions">
      <a
        className="admin-row-primary"
        href={`/${locale}/admin/platform/management-companies/${company.id}`}
      >
        {portfolioCopy.details}
        <ArrowRight aria-hidden="true" size={15} />
      </a>
      {canManage && company.status !== "CLOSED" ? (
        <details className="admin-row-menu">
          <summary aria-label={copy.edit}>
            <DotsThree aria-hidden="true" size={18} weight="bold" />
          </summary>
          <div className="admin-row-menu__popover">
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
              <label className="admin-field" htmlFor={`${prefix}-business-number`}>
                <span>{copy.businessNumber}</span>
                <input
                  defaultValue={formatBusinessNumber(company.businessNumber).replace("—", "")}
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
            <form action={changeManagementCompanyStatus} className="admin-tenant-status-form">
              <HiddenFields company={company} copy={copy} locale={locale} />
              <input
                aria-label={copy.status}
                name="currentStatus"
                type="hidden"
                value={company.status}
              />
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
                <button
                  className="tt-button tt-button--secondary tt-button--compact"
                  name="nextStatus"
                  type="submit"
                  value={company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                >
                  {company.status === "ACTIVE" ? copy.suspend : copy.reactivate}
                </button>
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
      ) : null}
    </div>
  );
}

export function ManagementCompanyCatalogView({
  canManage,
  catalog,
  copy,
  errorMessage,
  locale,
  portfolioCopy,
  search,
  stateFilter,
  statusMessage,
}: ManagementCompanyCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const activeCompanyCount = catalog.items.filter((company) => company.status === "ACTIVE").length;
  const siteCount = catalog.items.reduce((total, company) => total + company.siteCount, 0);
  const activeQrCount = catalog.items.reduce((total, company) => total + company.activeQrCount, 0);
  const reviewCompanies = catalog.items.filter((company) => company.status !== "ACTIVE");
  const formattedDate = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
    dateStyle: "medium",
  });
  const number = new Intl.NumberFormat(locale);
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const columns = [
    {
      cell: (company) => (
        <span className="tt-table-entity">
          <strong>{company.name}</strong>
          <small>{formatBusinessNumber(company.businessNumber)}</small>
        </span>
      ),
      header: copy.name,
      key: "name",
    },
    {
      align: "right",
      cell: (company) => number.format(company.siteCount),
      header: portfolioCopy.sites,
      key: "sites",
    },
    {
      align: "right",
      cell: (company) => number.format(company.contractVehicleLimit),
      header: portfolioCopy.capacity,
      key: "capacity",
    },
    {
      align: "right",
      cell: (company) => number.format(company.activeQrCount),
      header: portfolioCopy.activeQr,
      key: "activeQr",
    },
    {
      cell: (company) => (
        <StatusPill tone={riskTone(company.status)}>
          {company.status === "ACTIVE"
            ? portfolioCopy.healthGood
            : portfolioCopy.healthNeedsAttention}
        </StatusPill>
      ),
      header: portfolioCopy.contractHealth,
      key: "riskLevel",
    },
    {
      cell: (company) => (
        <time dateTime={company.createdAt}>
          {formattedDate.format(new Date(company.createdAt))}
        </time>
      ),
      header: copy.createdAt,
      key: "createdAt",
    },
    {
      cell: (company) => (
        <ManagementCompanyRowActions
          canManage={canManage}
          company={company}
          copy={copy}
          locale={locale}
          portfolioCopy={portfolioCopy}
        />
      ),
      header: copy.actions,
      key: "actions",
    },
  ] satisfies Array<DataTableColumn<CompanyRow>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/management-companies`}
      />

      <PageHeader
        actions={
          canManage ? (
            <ManagementCompanyCreatePanel catalog={catalog} copy={copy} locale={locale} />
          ) : null
        }
        className="admin-compact-heading"
        description={portfolioCopy.portfolioDescription}
        eyebrow={copy.eyebrow}
        lines={headingLine(portfolioCopy.portfolioTitle)}
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

      <StatStrip
        aria-label={portfolioCopy.companyPortfolio}
        className="admin-stat-strip"
        columns={4}
      >
        <StatTile
          icon={<UsersThree aria-hidden="true" size={24} />}
          label={portfolioCopy.resultCompanies}
          value={number.format(catalog.total)}
        />
        <StatTile
          icon={<Buildings aria-hidden="true" size={24} />}
          label={portfolioCopy.currentPageActive}
          value={number.format(activeCompanyCount)}
        />
        <StatTile
          icon={<Buildings aria-hidden="true" size={24} />}
          label={portfolioCopy.currentPageSites}
          value={number.format(siteCount)}
        />
        <StatTile
          icon={<QrCode aria-hidden="true" size={24} />}
          label={portfolioCopy.currentPageQr}
          value={number.format(activeQrCount)}
        />
      </StatStrip>

      <div className="admin-catalog-layout">
        <section className="admin-portfolio-panel">
          <header className="admin-portfolio-panel__header">
            <div>
              <span className="admin-hierarchy-label">{portfolioCopy.hierarchyLabel}</span>
              <h2>{portfolioCopy.companyPortfolio}</h2>
              <p>{portfolioCopy.companyPortfolioDescription}</p>
            </div>
          </header>

          <form method="get">
            <FilterBar
              actions={
                <>
                  <button className="tt-button tt-button--compact" type="submit">
                    {portfolioCopy.applyFilters}
                  </button>
                  <a
                    className="tt-button tt-button--secondary tt-button--compact"
                    href={`/${locale}/admin/platform/management-companies`}
                  >
                    {portfolioCopy.clearFilters}
                  </a>
                </>
              }
              className="admin-catalog-filter-bar"
              filters={
                <label className="admin-filter-select" htmlFor="company-state-filter">
                  <Funnel aria-hidden="true" size={16} />
                  <span className="sr-only">{portfolioCopy.statusFilter}</span>
                  <select defaultValue={stateFilter ?? ""} id="company-state-filter" name="state">
                    <option value="">{portfolioCopy.allStatuses}</option>
                    <option value="ACTIVE">{copy.statusLabels.ACTIVE}</option>
                    <option value="SUSPENDED">{copy.statusLabels.SUSPENDED}</option>
                    <option value="CLOSED">{copy.statusLabels.CLOSED}</option>
                  </select>
                </label>
              }
              search={
                <div className="admin-search-control admin-search-control--catalog">
                  <MagnifyingGlass aria-hidden="true" size={17} />
                  <label className="sr-only" htmlFor="company-search">
                    {portfolioCopy.companySearch}
                  </label>
                  <input
                    defaultValue={search}
                    id="company-search"
                    name="q"
                    placeholder={portfolioCopy.companySearch}
                    type="search"
                  />
                </div>
              }
            />
          </form>

          <DataTable
            className="admin-table-scroll admin-table-scroll--catalog"
            columns={columns}
            empty={
              <EmptyState
                className="admin-catalog-empty admin-catalog-empty--compact"
                description={copy.emptyDescription}
                title={copy.emptyTitle}
              />
            }
            getRowKey={(company) => company.id}
            rows={catalog.items}
          />

          <footer className="admin-catalog-footer">
            <span>{copy.total.replace("{count}", number.format(catalog.total))}</span>
            <Pagination
              aria-label={copy.paginationLabel}
              className="admin-pagination admin-pagination--compact"
              next={
                hasNext ? (
                  <a
                    className="tt-button tt-button--secondary tt-button--compact"
                    href={getPageHref(locale, catalog.page + 1, search, stateFilter)}
                  >
                    {copy.next}
                  </a>
                ) : (
                  <span />
                )
              }
              previous={
                hasPrevious ? (
                  <a
                    className="tt-button tt-button--secondary tt-button--compact"
                    href={getPageHref(locale, catalog.page - 1, search, stateFilter)}
                  >
                    {copy.previous}
                  </a>
                ) : (
                  <span />
                )
              }
              summary={copy.page
                .replace("{current}", String(catalog.page))
                .replace("{total}", String(totalPages))}
            />
          </footer>
        </section>

        <aside className="admin-catalog-decision-queue" aria-labelledby="company-review-title">
          <header>
            <div>
              <p className="eyebrow">{portfolioCopy.reviewItemLabel}</p>
              <h2 id="company-review-title">{portfolioCopy.decisionQueue}</h2>
            </div>
            <strong>{number.format(reviewCompanies.length)}</strong>
          </header>
          <p>{portfolioCopy.decisionQueueDescription}</p>
          {reviewCompanies.length > 0 ? (
            <ul>
              {reviewCompanies.slice(0, 5).map((company) => (
                <li key={company.id}>
                  <WarningCircle aria-hidden="true" size={17} />
                  <div>
                    <strong>{company.name}</strong>
                    <span>{copy.statusLabels[company.status]}</span>
                  </div>
                  <a href={`/${locale}/admin/platform/management-companies/${company.id}`}>
                    {portfolioCopy.details}
                    <ArrowRight aria-hidden="true" size={14} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-catalog-decision-queue__empty">
              <strong>{portfolioCopy.decisionQueueEmptyTitle}</strong>
              <span>{portfolioCopy.decisionQueueEmptyDescription}</span>
            </div>
          )}
        </aside>
      </div>

      {!canManage ? <p className="admin-catalog-read-only">{copy.readOnly}</p> : null}
      <p className="admin-overview-scope-note">{copy.securityNote}</p>
    </>
  );
}
