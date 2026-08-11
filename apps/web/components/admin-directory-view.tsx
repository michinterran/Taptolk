"use client";

import { ShieldCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { AdminDirectoryItem } from "@taptolk/application";
import {
  ADMIN_ROLES,
  ADMIN_SCOPE_TYPES,
  type AdminRole,
  type AdminScopeType,
} from "@taptolk/domain";
import { ConsoleTabs, DataTable, PageHeader, StatusPill } from "@taptolk/ui";
import { useEffect, useMemo, useState } from "react";
import { updateAdminDirectoryMembership } from "../admin/admin-directory-actions";
import { getAdminRoleLabel, getAdminScopeLabel } from "../content/admin-copy";
import type { AdminDirectoryCopy } from "../content/admin-directory-copy";
import type { getMessages } from "../content/messages";
import type { AppLocale } from "../i18n/config";

const PAGE_SIZE = 10;

type RoleFilter = AdminRole | "ALL";
type ScopeFilter = AdminScopeType | "ALL";
type StatusFilter = AdminDirectoryItem["status"] | "ALL";
type SortKey = "createdAt" | "name" | "role" | "status";
type SortDirection = "asc" | "desc";

function availableRoles(
  item: AdminDirectoryItem,
  actorIsSuperAdmin: boolean,
): readonly AdminRole[] {
  if (item.scope.type === "PLATFORM") return ["SUPER_ADMIN", "PLATFORM_OPERATOR"];
  if (item.scope.type === "MANAGEMENT_COMPANY") {
    return actorIsSuperAdmin ? ["MANAGEMENT_ADMIN", "READ_ONLY"] : ["READ_ONLY"];
  }
  if (item.scope.type === "SITE") return ["SITE_ADMIN", "SITE_OPERATOR", "READ_ONLY"];
  return ["READ_ONLY"];
}

function getDirectoryStatusTone(
  status: AdminDirectoryItem["status"],
): "info" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "REVOKED") return "danger";
  if (status === "INVITED") return "info";
  return "warning";
}

function formatTemplate(template: string, values: Record<string, number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function getDirectoryRoleLabel(
  item: AdminDirectoryItem,
  copy: AdminDirectoryCopy,
  messages: ReturnType<typeof getMessages>,
): string {
  if (item.role === "SUPER_ADMIN") return copy.serviceSuperAdmin;
  if (item.role === "PLATFORM_OPERATOR") return copy.serviceAdmin;
  if (item.role === "MANAGEMENT_ADMIN" || item.role === "SITE_ADMIN") {
    return copy.designatedAdmin;
  }
  return getAdminRoleLabel(messages, item.role);
}

function getDirectoryRoleFilterLabel(
  role: AdminRole,
  copy: AdminDirectoryCopy,
  messages: ReturnType<typeof getMessages>,
): string {
  if (role === "SUPER_ADMIN") return copy.serviceSuperAdmin;
  if (role === "PLATFORM_OPERATOR") return copy.serviceAdmin;
  if (role === "MANAGEMENT_ADMIN") return `${copy.designatedAdmin} · ${copy.managementCompany}`;
  if (role === "SITE_ADMIN") return `${copy.designatedAdmin} · ${copy.site}`;
  return getAdminRoleLabel(messages, role);
}

function MembershipHiddenFields({
  copy,
  includeRole = false,
  item,
  locale,
}: {
  copy: AdminDirectoryCopy;
  includeRole?: boolean;
  item: AdminDirectoryItem;
  locale: AppLocale;
}) {
  return (
    <>
      <input aria-label={copy.account} name="locale" type="hidden" value={locale} />
      <input
        aria-label={copy.account}
        name="membershipId"
        type="hidden"
        value={item.membershipId}
      />
      <input aria-label={copy.account} name="expectedVersion" type="hidden" value={item.version} />
      <input aria-label={copy.scope} name="scopeType" type="hidden" value={item.scope.type} />
      <input
        aria-label={copy.scope}
        name="tenantId"
        type="hidden"
        value={item.scope.tenantId ?? ""}
      />
      <input
        aria-label={copy.scope}
        name="managementCompanyId"
        type="hidden"
        value={item.scope.managementCompanyId ?? ""}
      />
      <input aria-label={copy.scope} name="siteId" type="hidden" value={item.scope.siteId ?? ""} />
      {includeRole ? (
        <input aria-label={copy.role} name="role" type="hidden" value={item.role} />
      ) : null}
    </>
  );
}

export function AdminDirectoryView({
  canApprove,
  actorIsSuperAdmin,
  copy,
  currentUserId,
  errorMessage,
  items,
  locale,
  messages,
  statusMessage,
}: {
  canApprove: boolean;
  actorIsSuperAdmin: boolean;
  copy: AdminDirectoryCopy;
  currentUserId: string;
  errorMessage?: string | null;
  items: readonly AdminDirectoryItem[];
  locale: AppLocale;
  messages: ReturnType<typeof getMessages>;
  statusMessage?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AdminDirectoryItem | null>(null);

  const statusLabel = {
    ACTIVE: copy.active,
    INVITED: copy.invited,
    REVOKED: copy.revoked,
    SUSPENDED: copy.suspended,
  } as const;

  useEffect(() => {
    if (!selectedItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem]);

  const roleOptions = useMemo(
    () => ADMIN_ROLES.filter((role) => items.some((item) => item.role === role)),
    [items],
  );
  const scopeOptions = useMemo(
    () => ADMIN_SCOPE_TYPES.filter((scope) => items.some((item) => item.scope.type === scope)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (roleFilter !== "ALL" && item.role !== roleFilter) return false;
      if (scopeFilter !== "ALL" && item.scope.type !== scopeFilter) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const searchableText = [
        item.displayName,
        item.email,
        item.managementCompanyName,
        item.siteName,
        item.tenantName,
        getAdminRoleLabel(messages, item.role),
        getAdminScopeLabel(messages, item.scope.type),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [items, messages, query, roleFilter, scopeFilter, statusFilter]);

  const sortedItems = useMemo(() => {
    const collator = new Intl.Collator(locale === "ko" ? "ko-KR" : "en-US", {
      numeric: true,
      sensitivity: "base",
    });
    const result = [...filteredItems].sort((left, right) => {
      let comparison = 0;
      if (sortKey === "createdAt") {
        comparison = left.createdAt.localeCompare(right.createdAt);
      } else if (sortKey === "role") {
        comparison = collator.compare(
          getDirectoryRoleFilterLabel(left.role, copy, messages),
          getDirectoryRoleFilterLabel(right.role, copy, messages),
        );
      } else if (sortKey === "status") {
        comparison = collator.compare(statusLabel[left.status], statusLabel[right.status]);
      } else {
        comparison = collator.compare(left.displayName, right.displayName);
      }
      if (comparison === 0) comparison = collator.compare(left.membershipId, right.membershipId);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return result;
  }, [copy, filteredItems, locale, messages, sortDirection, sortKey, statusLabel]);

  const pageCount = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = sortedItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = sortedItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sortedItems.length);

  const paginationItems = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const pages = new Set([1, pageCount, currentPage, currentPage - 1, currentPage + 1]);
    return Array.from(pages)
      .filter((value) => value >= 1 && value <= pageCount)
      .sort((left, right) => left - right);
  }, [currentPage, pageCount]);

  const formatCreatedAt = (value: string) =>
    new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));

  const formatLastChange = (item: AdminDirectoryItem) => {
    if (!item.lastChangedAction || !item.lastChangedAt) return copy.noChange;
    const action = copy.lastChangeActions[item.lastChangedAction];
    const changedAt = formatCreatedAt(item.lastChangedAt);
    return `${action} · ${changedAt}`;
  };

  const scopeTarget = (item: AdminDirectoryItem) => {
    if (item.scope.type === "PLATFORM") return copy.service;
    if (item.scope.type === "MANAGEMENT_COMPANY") {
      return item.managementCompanyName ?? copy.noScopeTarget;
    }
    if (item.scope.type === "SITE") {
      return (
        [item.managementCompanyName, item.siteName].filter(Boolean).join(" → ") ||
        copy.noScopeTarget
      );
    }
    return item.tenantName ?? copy.noScopeTarget;
  };

  const scopeLabel = (item: AdminDirectoryItem) => {
    if (item.scope.type === "PLATFORM") return copy.service;
    if (item.scope.type === "MANAGEMENT_COMPANY") return copy.managementCompany;
    if (item.scope.type === "SITE") return copy.site;
    return getAdminScopeLabel(messages, item.scope.type);
  };

  const resetFilters = () => {
    setQuery("");
    setRoleFilter("ALL");
    setScopeFilter("ALL");
    setStatusFilter("ALL");
    setSortKey("name");
    setSortDirection("asc");
    setPage(1);
  };

  const columns = [
    {
      cell: (item: AdminDirectoryItem) => (
        <span className="admin-directory-account">
          <UserCircle aria-hidden="true" size={24} />
          <span>
            <strong>{item.displayName}</strong>
            <small>{item.email ?? copy.noEmail}</small>
          </span>
        </span>
      ),
      header: copy.account,
      key: "account",
    },
    {
      cell: (item: AdminDirectoryItem) => (
        <span className="admin-directory-role-cell">
          <strong>{getDirectoryRoleLabel(item, copy, messages)}</strong>
          <small>{copy.roleDescriptions[item.role]}</small>
          <small className="admin-directory-change-summary">
            {copy.lastChange}: {formatLastChange(item)}
          </small>
        </span>
      ),
      header: copy.role,
      key: "role",
    },
    {
      cell: (item: AdminDirectoryItem) => (
        <span className="admin-directory-scope-cell">
          <strong>{scopeTarget(item)}</strong>
          <small>{scopeLabel(item)}</small>
        </span>
      ),
      header: copy.scopeTarget,
      key: "scope",
    },
    {
      cell: (item: AdminDirectoryItem) => (
        <StatusPill tone={getDirectoryStatusTone(item.status)}>
          {statusLabel[item.status]}
        </StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      cell: (item: AdminDirectoryItem) => formatCreatedAt(item.createdAt),
      header: copy.created,
      key: "created",
    },
    {
      cell: (item: AdminDirectoryItem) =>
        item.userId === currentUserId ? (
          <ShieldCheck aria-label={copy.account} size={20} />
        ) : (
          <button
            className="tt-button tt-button--secondary tt-button--compact"
            type="button"
            onClick={() => setSelectedItem(item)}
          >
            {item.status === "INVITED" ? copy.invitationActions : copy.permissionEdit}
          </button>
        ),
      header: copy.actions,
      key: "actions",
    },
  ];

  return (
    <div className="admin-directory-shell">
      <PageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={[copy.title]}
        actions={
          canApprove ? (
            <a
              className="tt-button tt-button--secondary tt-button--compact"
              href={`/${locale}/admin/platform/access`}
            >
              {copy.approveAccounts}
            </a>
          ) : null
        }
      />
      {statusMessage ? (
        <section className="admin-notice admin-notice--success" role="status">
          <strong>{statusMessage}</strong>
        </section>
      ) : null}
      {errorMessage ? (
        <section className="admin-notice admin-notice--danger" role="alert">
          <strong>{errorMessage}</strong>
        </section>
      ) : null}
      <ConsoleTabs
        ariaLabel={copy.eyebrow}
        items={[
          {
            count: items.length,
            current: true,
            href: `/${locale}/admin/accounts`,
            id: "accounts",
            label: copy.eyebrow,
          },
          ...(canApprove
            ? [
                {
                  href: `/${locale}/admin/platform/access`,
                  id: "approvals",
                  label: copy.approveAccounts,
                },
              ]
            : []),
        ]}
      />
      <section aria-label={copy.eyebrow} className="console-list-surface admin-directory-panel">
        <search className="admin-directory-toolbar">
          <label className="admin-directory-search">
            <span>{copy.search}</span>
            <input
              aria-label={copy.search}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder={copy.searchPlaceholder}
              type="search"
              value={query}
            />
          </label>
          <div className="admin-directory-filters">
            <label>
              <span>{copy.role}</span>
              <select
                aria-label={copy.role}
                onChange={(event) => {
                  setPage(1);
                  setRoleFilter(event.target.value as RoleFilter);
                }}
                value={roleFilter}
              >
                <option value="ALL">{copy.allRoles}</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {getDirectoryRoleFilterLabel(role, copy, messages)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.scope}</span>
              <select
                aria-label={copy.scope}
                onChange={(event) => {
                  setPage(1);
                  setScopeFilter(event.target.value as ScopeFilter);
                }}
                value={scopeFilter}
              >
                <option value="ALL">{copy.allScopes}</option>
                {scopeOptions.map((scope) => (
                  <option key={scope} value={scope}>
                    {getAdminScopeLabel(messages, scope)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.status}</span>
              <select
                aria-label={copy.status}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value as StatusFilter);
                }}
                value={statusFilter}
              >
                <option value="ALL">{copy.allStatuses}</option>
                <option value="ACTIVE">{copy.active}</option>
                <option value="INVITED">{copy.invited}</option>
                <option value="SUSPENDED">{copy.suspended}</option>
                <option value="REVOKED">{copy.revoked}</option>
              </select>
            </label>
          </div>
          <div className="admin-directory-sort">
            <label>
              <span>{copy.sort}</span>
              <select
                aria-label={copy.sort}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                value={sortKey}
              >
                <option value="name">{copy.sortName}</option>
                <option value="role">{copy.sortRole}</option>
                <option value="status">{copy.sortStatus}</option>
                <option value="createdAt">{copy.sortCreated}</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{copy.sort}</span>
              <select
                aria-label={copy.sort}
                onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                value={sortDirection}
              >
                <option value="asc">{copy.ascending}</option>
                <option value="desc">{copy.descending}</option>
              </select>
            </label>
            <button
              className="tt-button tt-button--ghost tt-button--compact"
              type="button"
              onClick={resetFilters}
            >
              {copy.reset}
            </button>
          </div>
        </search>
        <div className="admin-directory-summary">
          <strong>
            {formatTemplate(copy.resultSummary, {
              from: rangeStart,
              to: rangeEnd,
              total: sortedItems.length,
            })}
          </strong>
        </div>
        <DataTable
          columns={columns}
          empty={copy.emptyResults}
          getRowKey={(item) => item.membershipId}
          rows={visibleItems}
        />
        <footer className="admin-directory-footer">
          <button
            aria-label={copy.previous}
            className="tt-button tt-button--secondary tt-button--compact"
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            {copy.previous}
          </button>
          <nav aria-label={copy.eyebrow} className="admin-directory-pagination">
            {paginationItems.map((pageNumber, index) => {
              const previousPage = paginationItems[index - 1];
              const needsGap = previousPage !== undefined && pageNumber - previousPage > 1;
              return (
                <span className="admin-directory-pagination__item" key={pageNumber}>
                  {needsGap ? <span aria-hidden="true">...</span> : null}
                  <button
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    className={`tt-button tt-button--compact${pageNumber === currentPage ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                </span>
              );
            })}
          </nav>
          <button
            aria-label={copy.next}
            className="tt-button tt-button--secondary tt-button--compact"
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            {copy.next}
          </button>
        </footer>
      </section>

      {selectedItem ? (
        <div className="admin-directory-overlay">
          <aside
            aria-labelledby="admin-directory-editor-title"
            aria-modal="true"
            className="admin-directory-drawer"
            role="dialog"
          >
            <header className="admin-directory-drawer__header">
              <div>
                <p className="eyebrow">{copy.actions}</p>
                <h2 id="admin-directory-editor-title">
                  {selectedItem.status === "INVITED" ? copy.invitationActions : copy.permissionEdit}
                </h2>
              </div>
              <button
                aria-label={copy.close}
                className="tt-button tt-button--ghost tt-button--compact"
                type="button"
                onClick={() => setSelectedItem(null)}
              >
                {copy.close}
              </button>
            </header>
            <div className="admin-directory-drawer__body">
              <section className="admin-directory-editor-identity">
                <strong>{selectedItem.displayName}</strong>
                <span>{selectedItem.email ?? copy.noEmail}</span>
                <small>
                  {getDirectoryRoleLabel(selectedItem, copy, messages)} {"·"}{" "}
                  {scopeTarget(selectedItem)}
                </small>
                <small className="admin-directory-change-summary">
                  {copy.lastChange}: {formatLastChange(selectedItem)}
                  {selectedItem.lastChangedByDisplayName
                    ? ` · ${selectedItem.lastChangedByDisplayName}`
                    : ""}
                </small>
              </section>
              {selectedItem.status === "INVITED" ? (
                <p className="admin-directory-invitation-note">{copy.invitationPending}</p>
              ) : null}
              <form action={updateAdminDirectoryMembership} className="admin-directory-form">
                <MembershipHiddenFields
                  copy={copy}
                  includeRole={selectedItem.status === "INVITED"}
                  item={selectedItem}
                  locale={locale}
                />
                {selectedItem.status === "INVITED" ? (
                  <input aria-label={copy.status} name="status" type="hidden" value="REVOKED" />
                ) : (
                  <>
                    <label>
                      <span>{copy.role}</span>
                      <select aria-label={copy.role} defaultValue={selectedItem.role} name="role">
                        {availableRoles(selectedItem, actorIsSuperAdmin).map((role) => (
                          <option key={role} value={role}>
                            {getAdminRoleLabel(messages, role)}
                          </option>
                        ))}
                      </select>
                      <small>{copy.roleDescriptions[selectedItem.role]}</small>
                    </label>
                    <label>
                      <span>{copy.status}</span>
                      <select
                        aria-label={copy.status}
                        defaultValue={selectedItem.status}
                        name="status"
                      >
                        <option value="ACTIVE">{copy.active}</option>
                        <option value="SUSPENDED">{copy.suspended}</option>
                        <option value="REVOKED">{copy.revoked}</option>
                      </select>
                    </label>
                  </>
                )}
                <label>
                  <span>{copy.reason}</span>
                  <textarea
                    aria-label={copy.reason}
                    maxLength={500}
                    minLength={3}
                    name="reason"
                    placeholder={
                      selectedItem.status === "INVITED"
                        ? copy.invitationCancelReasonPlaceholder
                        : copy.reasonPlaceholder
                    }
                    required
                  />
                </label>
                <div className="admin-directory-drawer__actions">
                  <button
                    className="tt-button tt-button--secondary"
                    type="button"
                    onClick={() => setSelectedItem(null)}
                  >
                    {copy.cancel}
                  </button>
                  <button
                    className={`tt-button${selectedItem.status === "INVITED" ? " tt-button--danger" : ""}`}
                    type="submit"
                  >
                    {selectedItem.status === "INVITED" ? copy.cancelInvitation : copy.save}
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
