import { ArrowRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import type { ManagementCompanyCatalogPage, OrganizationStatus } from "@taptolk/application";
import {
  ConsoleTabs,
  DataTable,
  type DataTableColumn,
  EmptyState,
  MeterBar,
  PageHeader,
  Pagination,
  StatusPill,
} from "@taptolk/ui";
import type { AdminCompanyPortfolioCopy } from "../content/admin-company-portfolio-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyCopy {
  actions: string;
  address: string;
  addressHelp: string;
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
  managementCode: string;
  managementCodeHelp: string;
  name: string;
  platformDirect: string;
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
type RiskLevel = CompanyRow["riskLevel"];
type ResponseQuality = CompanyRow["responseQuality"];

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

function headingLine(value: string): readonly [string] {
  return [value];
}

function percent(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function riskTone(riskLevel: RiskLevel): "danger" | "muted" | "success" | "warning" {
  return riskLevel === "RISK"
    ? "danger"
    : riskLevel === "WATCH"
      ? "warning"
      : riskLevel === "NORMAL"
        ? "muted"
        : "success";
}

function riskLabel(riskLevel: RiskLevel, copy: AdminCompanyPortfolioCopy): string {
  return riskLevel === "RISK"
    ? copy.riskRisk
    : riskLevel === "WATCH"
      ? copy.riskWatch
      : riskLevel === "NORMAL"
        ? copy.riskNormal
        : copy.riskGood;
}

function responseTone(quality: ResponseQuality): "danger" | "muted" | "success" | "warning" {
  return quality === "LOW"
    ? "danger"
    : quality === "GOOD"
      ? "success"
      : quality === "NORMAL"
        ? "warning"
        : "muted";
}

function responseLabel(quality: ResponseQuality, copy: AdminCompanyPortfolioCopy): string {
  return quality === "LOW"
    ? copy.responseLow
    : quality === "GOOD"
      ? copy.responseGood
      : quality === "NORMAL"
        ? copy.responseNormal
        : copy.noResponseData;
}

function planLabel(company: CompanyRow, copy: AdminCompanyPortfolioCopy): string {
  if (!company.contractPlan) {
    return copy.noContract;
  }
  return company.contractPlan
    .toLowerCase()
    .split(/[_-]+/u)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function contractStatusLabel(company: CompanyRow, copy: AdminCompanyPortfolioCopy): string {
  return company.contractStatus === "ACTIVE"
    ? copy.contractStatusActive
    : company.contractStatus === "DRAFT"
      ? copy.contractStatusDraft
      : company.contractStatus === "EXPIRED"
        ? copy.contractStatusExpired
        : company.contractStatus === "SUSPENDED"
          ? copy.contractStatusSuspended
          : company.contractStatus === "TERMINATED"
            ? copy.contractStatusTerminated
            : copy.noContract;
}

function companySubline(company: CompanyRow, copy: ManagementCompanyCopy): string {
  return company.address ? `${copy.address} ${company.address}` : "";
}

function shouldShowPlatformDirectBadge(company: CompanyRow, copy: ManagementCompanyCopy): boolean {
  return company.isPlatformDirect && !company.name.includes(copy.platformDirect);
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
  const number = new Intl.NumberFormat(locale);
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const columns = [
    {
      cell: (company) => (
        <span className="tt-table-entity admin-catalog-company-cell">
          <strong>
            <a href={`/${locale}/admin/platform/management-companies/${company.id}`}>
              {company.name}
            </a>
            {shouldShowPlatformDirectBadge(company, copy) ? (
              <span className="tt-direct-badge">{copy.platformDirect}</span>
            ) : null}
          </strong>
          {companySubline(company, copy) ? <small>{companySubline(company, copy)}</small> : null}
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
      cell: (company) => (
        <span className="admin-plan-cell">
          <strong>{planLabel(company, portfolioCopy)}</strong>
          <small>{contractStatusLabel(company, portfolioCopy)}</small>
        </span>
      ),
      header: portfolioCopy.planStatus,
      key: "plan",
    },
    {
      cell: (company) => (
        <div className="admin-meter-cell">
          <strong>{percent(company.capacityUsagePercent, locale)}%</strong>
          <MeterBar
            tone={
              company.capacityUsagePercent >= 90
                ? "danger"
                : company.capacityUsagePercent >= 75
                  ? "warning"
                  : "success"
            }
            value={company.capacityUsagePercent}
          />
        </div>
      ),
      header: portfolioCopy.capacityUsage,
      key: "capacityUsage",
    },
    {
      align: "right",
      cell: (company) => `${percent(company.qrActivationPercent, locale)}%`,
      header: portfolioCopy.qrActivationRate,
      key: "qrActivation",
    },
    {
      cell: (company) => (
        <StatusPill tone={responseTone(company.responseQuality)}>
          {responseLabel(company.responseQuality, portfolioCopy)}
        </StatusPill>
      ),
      header: portfolioCopy.responseQuality,
      key: "responseQuality",
    },
    {
      cell: (company) => (
        <StatusPill tone={riskTone(company.riskLevel)}>
          {riskLabel(company.riskLevel, portfolioCopy)}
        </StatusPill>
      ),
      header: portfolioCopy.contractHealth,
      key: "riskLevel",
    },
    {
      align: "right",
      cell: (company) => (
        <a
          className="admin-catalog-detail-link"
          href={`/${locale}/admin/platform/management-companies/${company.id}`}
        >
          {portfolioCopy.details}
          <ArrowRight aria-hidden="true" size={14} />
        </a>
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

      <div className="admin-catalog-canvas console-page console-list-page">
        <div className="admin-catalog-main">
          <PageHeader
            actions={
              canManage ? (
                <a
                  className="tt-button tt-button--compact"
                  href={`/${locale}/admin/platform/management-companies/new`}
                >
                  <Plus aria-hidden="true" size={16} />
                  {copy.createTitle}
                </a>
              ) : null
            }
            className="admin-compact-heading admin-catalog-heading"
            description={portfolioCopy.portfolioDescription}
            eyebrow={copy.eyebrow}
            lines={headingLine(portfolioCopy.portfolioTitle)}
          />

          <ConsoleTabs
            ariaLabel={portfolioCopy.companyPortfolio}
            items={[
              {
                count: number.format(catalog.total),
                current: true,
                href: `/${locale}/admin/platform/management-companies`,
                id: "management-companies",
                label: portfolioCopy.companyPortfolio,
              },
              {
                count: number.format(catalog.siteTotal),
                href: `/${locale}/admin/sites`,
                id: "sites",
                label: portfolioCopy.sites,
              },
            ]}
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

          <section className="console-list-surface">
            <form method="get">
              <div className="admin-catalog-filter-bar console-list-toolbar">
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
                <button className="tt-button tt-button--compact" type="submit">
                  {portfolioCopy.applyFilters}
                </button>
                <a
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={`/${locale}/admin/platform/management-companies`}
                >
                  {portfolioCopy.clearFilters}
                </a>
              </div>
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
                    <button
                      className="tt-button tt-button--secondary tt-button--compact"
                      disabled
                      type="button"
                    >
                      {copy.next}
                    </button>
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
                    <button
                      className="tt-button tt-button--secondary tt-button--compact"
                      disabled
                      type="button"
                    >
                      {copy.previous}
                    </button>
                  )
                }
                summary={copy.page
                  .replace("{current}", String(catalog.page))
                  .replace("{total}", String(totalPages))}
              />
              <span className="admin-catalog-page-size">{portfolioCopy.pageSize}</span>
            </footer>
          </section>

          {!canManage ? <p className="admin-catalog-read-only">{copy.readOnly}</p> : null}
          <p className="admin-overview-scope-note">{copy.securityNote}</p>
        </div>
      </div>
    </>
  );
}
