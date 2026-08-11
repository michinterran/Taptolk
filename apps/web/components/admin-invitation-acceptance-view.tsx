import { acceptAdminInvitation } from "../admin/account-invitation-actions";
import type { AppLocale } from "../i18n/config";

interface AdminInvitationAcceptanceViewProps {
  copy: {
    accept: string;
    description: string;
    role: string;
    scope: string;
    title: string;
  };
  invitation: {
    membershipId: string;
    roleLabel: string;
    scopeLabel: string;
  };
  locale: AppLocale;
}

export function AdminInvitationAcceptanceView({
  copy,
  invitation,
  locale,
}: AdminInvitationAcceptanceViewProps) {
  return (
    <section className="admin-invitation-card" aria-labelledby="admin-invitation-title">
      <p className="eyebrow">{copy.scope}</p>
      <h2 id="admin-invitation-title">{copy.title}</h2>
      <p>{copy.description}</p>
      <dl className="admin-invitation-card__meta">
        <div>
          <dt>{copy.role}</dt>
          <dd>{invitation.roleLabel}</dd>
        </div>
        <div>
          <dt>{copy.scope}</dt>
          <dd>{invitation.scopeLabel}</dd>
        </div>
      </dl>
      <form action={acceptAdminInvitation}>
        <input aria-label={copy.scope} name="locale" type="hidden" value={locale} />
        <input
          aria-label={copy.title}
          name="membershipId"
          type="hidden"
          value={invitation.membershipId}
        />
        <button className="tt-button" type="submit">
          {copy.accept}
        </button>
      </form>
    </section>
  );
}
