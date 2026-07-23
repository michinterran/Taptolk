import { ShieldCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { AdminDirectoryItem } from "@taptolk/application";
import type { AdminRole } from "@taptolk/domain";
import { DataTable, PageHeader, SideCard, StatusPill } from "@taptolk/ui";
import { updateAdminDirectoryMembership } from "../admin/admin-directory-actions";
import { getAdminRoleLabel } from "../content/admin-copy";
import type { AdminDirectoryCopy } from "../content/admin-directory-copy";
import type { getMessages } from "../content/messages";
import type { AppLocale } from "../i18n/config";

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

function scopeLabel(item: AdminDirectoryItem): string {
  return item.siteName ?? item.managementCompanyName ?? item.tenantName ?? "Taptolk";
}

function getDirectoryStatusTone(
  status: AdminDirectoryItem["status"],
): "info" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "REVOKED") {
    return "danger";
  }

  if (status === "INVITED") {
    return "info";
  }

  return "warning";
}

export function AdminDirectoryView({
  canApprove,
  actorIsSuperAdmin,
  copy,
  currentUserId,
  items,
  locale,
  messages,
}: {
  canApprove: boolean;
  actorIsSuperAdmin: boolean;
  copy: AdminDirectoryCopy;
  currentUserId: string;
  items: readonly AdminDirectoryItem[];
  locale: AppLocale;
  messages: ReturnType<typeof getMessages>;
}) {
  const statusLabel = {
    ACTIVE: copy.active,
    INVITED: copy.invited,
    REVOKED: copy.revoked,
    SUSPENDED: copy.suspended,
  } as const;
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
      cell: (item: AdminDirectoryItem) => getAdminRoleLabel(messages, item.role),
      header: copy.role,
      key: "role",
    },
    {
      cell: (item: AdminDirectoryItem) => scopeLabel(item),
      header: copy.scope,
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
      cell: (item: AdminDirectoryItem) =>
        item.userId === currentUserId ? (
          <ShieldCheck aria-label={copy.account} size={20} />
        ) : (
          <details className="admin-row-menu">
            <summary>{copy.actions}</summary>
            <form
              action={updateAdminDirectoryMembership}
              className="admin-row-menu__popover admin-directory-form"
            >
              <input aria-label={copy.account} name="locale" type="hidden" value={locale} />
              <input
                aria-label={copy.account}
                name="membershipId"
                type="hidden"
                value={item.membershipId}
              />
              <input
                aria-label={copy.account}
                name="expectedVersion"
                type="hidden"
                value={item.version}
              />
              <input
                aria-label={copy.scope}
                name="scopeType"
                type="hidden"
                value={item.scope.type}
              />
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
              <input
                aria-label={copy.scope}
                name="siteId"
                type="hidden"
                value={item.scope.siteId ?? ""}
              />
              <label>
                <span>{copy.role}</span>
                <select aria-label={copy.role} defaultValue={item.role} name="role">
                  {availableRoles(item, actorIsSuperAdmin).map((role) => (
                    <option key={role} value={role}>
                      {getAdminRoleLabel(messages, role)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{copy.status}</span>
                <select
                  aria-label={copy.status}
                  defaultValue={item.status === "INVITED" ? "ACTIVE" : item.status}
                  name="status"
                >
                  <option value="ACTIVE">{copy.active}</option>
                  <option value="SUSPENDED">{copy.suspended}</option>
                  <option value="REVOKED">{copy.revoked}</option>
                </select>
              </label>
              <label>
                <span>{copy.reason}</span>
                <textarea
                  aria-label={copy.reason}
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder={copy.reasonPlaceholder}
                  required
                />
              </label>
              <button className="tt-button" type="submit">
                {copy.save}
              </button>
            </form>
          </details>
        ),
      header: copy.actions,
      key: "actions",
    },
  ];

  return (
    <div className="operations-shell admin-directory-shell">
      <PageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={[copy.title]}
        actions={
          canApprove ? (
            <a className="tt-button tt-button--secondary" href={`/${locale}/admin/platform/access`}>
              {copy.approveAccounts}
            </a>
          ) : null
        }
      />
      <SideCard className="admin-directory-panel" title={copy.eyebrow}>
        <DataTable columns={columns} getRowKey={(item) => item.membershipId} rows={items} />
      </SideCard>
    </div>
  );
}
