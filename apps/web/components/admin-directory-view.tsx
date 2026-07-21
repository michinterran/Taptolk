import { ShieldCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { AdminDirectoryItem } from "@taptolk/application";
import type { AdminRole } from "@taptolk/domain";
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
  return (
    <div className="operations-shell admin-directory-shell">
      <header className="admin-compact-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        {canApprove ? (
          <a className="tt-button tt-button--secondary" href={`/${locale}/admin/platform/access`}>
            {copy.approveAccounts}
          </a>
        ) : null}
      </header>
      <section className="admin-directory-panel" aria-label={copy.eyebrow}>
        <div className="admin-command-table-wrap">
          <table className="admin-command-table admin-directory-table">
            <thead>
              <tr>
                <th scope="col">{copy.account}</th>
                <th scope="col">{copy.role}</th>
                <th scope="col">{copy.scope}</th>
                <th scope="col">{copy.status}</th>
                <th scope="col">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.membershipId}>
                  <th scope="row">
                    <span className="admin-directory-account">
                      <UserCircle aria-hidden="true" size={24} />
                      <span>
                        <strong>{item.displayName}</strong>
                        <small>{item.email ?? copy.noEmail}</small>
                      </span>
                    </span>
                  </th>
                  <td>{getAdminRoleLabel(messages, item.role)}</td>
                  <td>{scopeLabel(item)}</td>
                  <td>
                    <span className="admin-status-badge">{statusLabel[item.status]}</span>
                  </td>
                  <td>
                    {item.userId === currentUserId ? (
                      <ShieldCheck aria-label={copy.account} size={20} />
                    ) : (
                      <details className="admin-row-menu">
                        <summary>{copy.actions}</summary>
                        <form
                          action={updateAdminDirectoryMembership}
                          className="admin-row-menu__popover admin-directory-form"
                        >
                          <input
                            aria-label={copy.account}
                            name="locale"
                            type="hidden"
                            value={locale}
                          />
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
