import { IdentificationCard } from "@phosphor-icons/react/dist/ssr";
import type { AdminProfileModel } from "@taptolk/application";
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
      <header className="admin-compact-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>
      <section className="admin-profile-panel">
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
              <dd>{model.status}</dd>
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
      </section>
    </div>
  );
}
