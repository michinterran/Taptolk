import type {
  AdminApprovalQueue,
  AdminApprovalScopeCatalog,
  PendingAdminAccount,
} from "@taptolk/application";
import {
  ADMIN_ROLES,
  ADMIN_SCOPE_TYPES,
  type AdminRole,
  type AdminScopeType,
} from "@taptolk/domain";
import { EmptyState, PageHeader, Pagination, StatusPill } from "@taptolk/ui";
import { approvePendingAdmin, rejectPendingAdmin } from "../admin/account-approval-actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ApprovalCopy {
  account: string;
  approve: string;
  back: string;
  configurationDescription: string;
  configurationTitle: string;
  description: string;
  displayName: string;
  emailStatus: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  joinedAt: string;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  managementCompany: string;
  next: string;
  noManagementCompany: string;
  noSite: string;
  noTenant: string;
  page: string;
  paginationLabel: string;
  previous: string;
  provider: string;
  providerLabels: Readonly<Record<PendingAdminAccount["provider"], string>>;
  reason: string;
  reasonPlaceholder: string;
  reject: string;
  rejectDescription: string;
  rejectReason: string;
  rejectReasonPlaceholder: string;
  rejectSummary: string;
  role: string;
  roleLabels: Readonly<Record<AdminRole, string>>;
  scopeHelp: string;
  scopeLabels: Readonly<Record<AdminScopeType, string>>;
  scopeType: string;
  securityNote: string;
  signOut: string;
  site: string;
  statusLabels: {
    approved: string;
    rejected: string;
  };
  tenant: string;
  titleLines: readonly [string, ...string[]];
  total: string;
  truncated: string;
  verificationLabels: {
    pending: string;
    verified: string;
  };
}

interface AdminAccountApprovalViewProps {
  configurationMissing?: boolean;
  copy: ApprovalCopy;
  errorMessage?: string | null;
  locale: AppLocale;
  queue: AdminApprovalQueue;
  scopes: AdminApprovalScopeCatalog;
  status?: "approved" | "rejected" | null;
}

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/platform/access?page=${page}`;
}

function getFormatterLocale(locale: AppLocale): string {
  return locale === "ko" ? "ko-KR" : "en";
}

function CandidateCard({
  account,
  copy,
  locale,
  scopes,
}: {
  account: PendingAdminAccount;
  copy: ApprovalCopy;
  locale: AppLocale;
  scopes: AdminApprovalScopeCatalog;
}) {
  const fieldPrefix = `approval-${account.userId}`;

  return (
    <article className="admin-approval-card">
      <header className="admin-approval-card__header">
        <div>
          <span className="admin-approval-card__label">{copy.account}</span>
          <h2>{account.email}</h2>
        </div>
        <div className="admin-approval-signals">
          <StatusPill tone="neutral">{copy.providerLabels[account.provider]}</StatusPill>
          <StatusPill tone={account.emailVerified ? "success" : "warning"}>
            {account.emailVerified
              ? copy.verificationLabels.verified
              : copy.verificationLabels.pending}
          </StatusPill>
        </div>
      </header>

      <dl className="admin-approval-meta">
        <div>
          <dt>{copy.provider}</dt>
          <dd>{copy.providerLabels[account.provider]}</dd>
        </div>
        <div>
          <dt>{copy.emailStatus}</dt>
          <dd>
            {account.emailVerified
              ? copy.verificationLabels.verified
              : copy.verificationLabels.pending}
          </dd>
        </div>
        <div>
          <dt>{copy.joinedAt}</dt>
          <dd>
            <time dateTime={account.createdAt}>
              {new Intl.DateTimeFormat(getFormatterLocale(locale), {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(account.createdAt))}
            </time>
          </dd>
        </div>
      </dl>

      <form action={approvePendingAdmin} className="admin-approval-form">
        <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
        <input aria-label={copy.account} name="targetUserId" type="hidden" value={account.userId} />

        <label className="admin-field" htmlFor={`${fieldPrefix}-display-name`}>
          <span>{copy.displayName}</span>
          <input
            defaultValue={account.suggestedDisplayName}
            id={`${fieldPrefix}-display-name`}
            maxLength={100}
            name="displayName"
            required
          />
        </label>

        <div className="admin-approval-field-grid">
          <label className="admin-field" htmlFor={`${fieldPrefix}-role`}>
            <span>{copy.role}</span>
            <select
              defaultValue="PLATFORM_OPERATOR"
              id={`${fieldPrefix}-role`}
              name="role"
              required
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {copy.roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${fieldPrefix}-scope-type`}>
            <span>{copy.scopeType}</span>
            <select
              defaultValue="PLATFORM"
              id={`${fieldPrefix}-scope-type`}
              name="scopeType"
              required
            >
              {ADMIN_SCOPE_TYPES.map((scopeType) => (
                <option key={scopeType} value={scopeType}>
                  {copy.scopeLabels[scopeType]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="admin-approval-scope-help">{copy.scopeHelp}</p>

        <div className="admin-approval-field-grid admin-approval-field-grid--scope">
          <label className="admin-field" htmlFor={`${fieldPrefix}-tenant`}>
            <span>{copy.tenant}</span>
            <select defaultValue="" id={`${fieldPrefix}-tenant`} name="tenantId">
              <option value="">{copy.noTenant}</option>
              {scopes.tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${fieldPrefix}-management-company`}>
            <span>{copy.managementCompany}</span>
            <select
              defaultValue=""
              id={`${fieldPrefix}-management-company`}
              name="managementCompanyId"
            >
              <option value="">{copy.noManagementCompany}</option>
              {scopes.managementCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${fieldPrefix}-site`}>
            <span>{copy.site}</span>
            <select defaultValue="" id={`${fieldPrefix}-site`} name="siteId">
              <option value="">{copy.noSite}</option>
              {scopes.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="admin-field" htmlFor={`${fieldPrefix}-approval-reason`}>
          <span>{copy.reason}</span>
          <textarea
            id={`${fieldPrefix}-approval-reason`}
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder={copy.reasonPlaceholder}
            required
            rows={3}
          />
        </label>

        <button className="tt-button" type="submit">
          {copy.approve}
        </button>
      </form>

      <details className="admin-rejection-panel">
        <summary>{copy.rejectSummary}</summary>
        <p>{copy.rejectDescription}</p>
        <form action={rejectPendingAdmin} className="admin-rejection-form">
          <input
            aria-label={copy.displayName}
            name="displayName"
            type="hidden"
            value={account.suggestedDisplayName}
          />
          <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
          <input
            aria-label={copy.account}
            name="targetUserId"
            type="hidden"
            value={account.userId}
          />
          <label className="admin-field" htmlFor={`${fieldPrefix}-rejection-reason`}>
            <span>{copy.rejectReason}</span>
            <textarea
              id={`${fieldPrefix}-rejection-reason`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder={copy.rejectReasonPlaceholder}
              required
              rows={3}
            />
          </label>
          <button className="tt-button tt-button--danger" type="submit">
            {copy.reject}
          </button>
        </form>
      </details>
    </article>
  );
}

export function AdminAccountApprovalView({
  configurationMissing = false,
  copy,
  errorMessage,
  locale,
  queue,
  scopes,
  status = null,
}: AdminAccountApprovalViewProps) {
  const totalPages = Math.max(1, Math.ceil(queue.total / queue.pageSize));
  const hasPrevious = queue.page > 1;
  const hasNext = queue.page < totalPages;
  const pageSummary = copy.page
    .replace("{current}", String(queue.page))
    .replace("{total}", String(totalPages));

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/access`}
      />

      <PageHeader
        actions={
          <a className="tt-button tt-button--secondary" href={`/${locale}/admin/platform`}>
            {copy.back}
          </a>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={copy.titleLines}
      />

      {status ? (
        <section className="admin-notice admin-notice--success" role="status">
          <strong>{copy.statusLabels[status]}</strong>
        </section>
      ) : null}
      {errorMessage ? (
        <section className="admin-notice admin-notice--danger" role="alert">
          <strong>{errorMessage}</strong>
        </section>
      ) : null}

      <section className="admin-catalog-summary" aria-live="polite">
        <strong>{copy.total.replace("{count}", String(queue.total))}</strong>
        <span>{queue.truncated ? copy.truncated : copy.securityNote}</span>
      </section>

      <section className="admin-permission-matrix" aria-labelledby="permission-matrix-title">
        <header>
          <p className="eyebrow">{copy.securityNote}</p>
          <h2 id="permission-matrix-title">{copy.scopeType}</h2>
          <p>{copy.scopeHelp}</p>
        </header>
        <div className="admin-permission-matrix__grid">
          {ADMIN_ROLES.map((role) => (
            <article key={role}>
              <span>{copy.roleLabels[role]}</span>
              <p>
                {role === "SUPER_ADMIN"
                  ? copy.scopeLabels.PLATFORM
                  : role === "SITE_ADMIN" || role === "SITE_OPERATOR"
                    ? copy.scopeLabels.SITE
                    : role === "MANAGEMENT_ADMIN"
                      ? copy.scopeLabels.MANAGEMENT_COMPANY
                      : copy.scopeLabels.TENANT}
              </p>
            </article>
          ))}
        </div>
      </section>

      {configurationMissing ? (
        <EmptyState description={copy.configurationDescription} title={copy.configurationTitle} />
      ) : queue.accounts.length === 0 ? (
        <EmptyState description={copy.emptyDescription} title={copy.emptyTitle} />
      ) : (
        <section aria-label={copy.eyebrow} className="admin-approval-list">
          {queue.accounts.map((account) => (
            <CandidateCard
              account={account}
              copy={copy}
              key={account.userId}
              locale={locale}
              scopes={scopes}
            />
          ))}
        </section>
      )}

      <Pagination
        aria-label={copy.paginationLabel}
        next={
          hasNext ? (
            <a
              className="tt-button tt-button--secondary"
              href={getPageHref(locale, queue.page + 1)}
            >
              {copy.next}
            </a>
          ) : null
        }
        previous={
          hasPrevious ? (
            <a
              className="tt-button tt-button--secondary"
              href={getPageHref(locale, queue.page - 1)}
            >
              {copy.previous}
            </a>
          ) : null
        }
        summary={pageSummary}
      />
    </>
  );
}
