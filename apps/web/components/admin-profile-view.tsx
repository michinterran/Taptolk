import { IdentificationCard } from "@phosphor-icons/react/dist/ssr";
import type { AdminProfileModel } from "@taptolk/application";
import { PageHeader, SideCard, StatusPill } from "@taptolk/ui";
import { updateCurrentAdminProfile } from "../admin/admin-profile-actions";
import type { AdminProfileCopy } from "../content/admin-profile-copy";
import type { AppLocale } from "../i18n/config";

export function AdminProfileView({
  copy,
  email,
  locale,
  model,
  roleLabel,
  scopeLabel,
}: {
  copy: AdminProfileCopy;
  email: string | null;
  locale: AppLocale;
  model: AdminProfileModel;
  roleLabel: string;
  scopeLabel: string;
}) {
  return (
    <div className="operations-shell admin-profile-shell">
      <PageHeader description={copy.description} eyebrow={copy.eyebrow} lines={[copy.title]} />
      <SideCard className="admin-profile-panel" title={copy.title}>
        <aside>
          <IdentificationCard aria-hidden="true" size={32} />
          <dl>
            <div>
              <dt>{copy.role}</dt>
              <dd>{roleLabel}</dd>
            </div>
            <div>
              <dt>{copy.scope}</dt>
              <dd>{scopeLabel}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>
                <StatusPill tone={model.status === "ACTIVE" ? "success" : "warning"}>
                  {model.status}
                </StatusPill>
              </dd>
            </div>
          </dl>
        </aside>
        <form action={updateCurrentAdminProfile}>
          <input aria-label={copy.displayName} name="locale" type="hidden" value={locale} />
          <input
            aria-label={copy.displayName}
            name="expectedVersion"
            type="hidden"
            value={model.version}
          />
          <label>
            <span>{copy.displayName}</span>
            <input
              aria-label={copy.displayName}
              defaultValue={model.displayName}
              maxLength={100}
              name="displayName"
              required
            />
          </label>
          <label>
            <span>{copy.email}</span>
            <input aria-label={copy.email} readOnly value={email ?? "-"} />
            <small>{copy.emailHelp}</small>
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
      </SideCard>
    </div>
  );
}
