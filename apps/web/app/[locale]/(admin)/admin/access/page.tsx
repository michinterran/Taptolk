import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { signOutAdmin } from "../../../../../auth/actions";
import { loadAdminContext } from "../../../../../auth/admin-context";
import { loadAdminInvitationContext } from "../../../../../auth/admin-invitation-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { AdminInvitationAcceptanceView } from "../../../../../components/admin-invitation-acceptance-view";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../../content/admin-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function AdminAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  if (context.status === "LOAD_ERROR") {
    return (
      <main className="admin-auth-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          }}
          localeTitle={copy["locale.switcher.label"]}
          logoAlt={copy["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/access`}
        />
        <section className="admin-centered-state">
          <p className="eyebrow">{copy["admin.access.eyebrow"]}</p>
          <SemanticHeading
            className="admin-auth-title"
            lines={[copy["admin.access.error.load.title"]]}
          />
          <p>{copy["admin.access.error.load.description"]}</p>
          <a className="tt-button" href={`/${locale}/admin/access`}>
            {copy["shared.error.retry"]}
          </a>
        </section>
      </main>
    );
  }
  if (context.decision.state !== "ACCESS_DENIED") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  const reason =
    context.decision.reason === "PROFILE_INACTIVE"
      ? copy["admin.access.profileInactive"]
      : copy["admin.access.membershipInactive"];
  const invitation = await loadAdminInvitationContext();
  const errorValue = Array.isArray(query.error) ? query.error[0] : query.error;
  const errorMessage =
    errorValue === "expired"
      ? copy["admin.access.error.invitationExpired"]
      : errorValue === "configuration"
        ? copy["admin.approvals.error.configuration"]
        : errorValue === "forbidden"
          ? copy["admin.approvals.error.forbidden"]
          : errorValue === "conflict"
            ? copy["admin.approvals.error.conflict"]
            : errorValue === "validation"
              ? copy["admin.approvals.error.validation"]
              : errorValue === "unavailable"
                ? copy["admin.approvals.error.unavailable"]
                : null;

  return (
    <main className="admin-auth-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/access`}
      />
      <section className="admin-centered-state">
        <p className="eyebrow">{copy["admin.access.eyebrow"]}</p>
        <SemanticHeading
          className="admin-auth-title"
          lines={[copy["admin.access.line1"], copy["admin.access.line2"]]}
        />
        <p>{copy["admin.access.description"]}</p>
        <strong className="admin-access-reason">{reason}</strong>
        {errorMessage ? (
          <p className="admin-notice admin-notice--danger" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {invitation ? (
          <AdminInvitationAcceptanceView
            copy={{
              accept: copy["admin.access.invitation.accept"],
              description: copy["admin.access.invitation.description"],
              role: copy["admin.access.invitation.role"],
              scope: copy["admin.access.invitation.scope"],
              title: copy["admin.access.invitation.title"],
            }}
            invitation={{
              membershipId: invitation.membershipId,
              roleLabel: getAdminRoleLabel(copy, invitation.role),
              scopeLabel: getAdminScopeLabel(copy, invitation.scopeType),
            }}
            locale={locale}
          />
        ) : null}
        {context.email ? (
          <p className="admin-account-line">
            <span>{copy["admin.shared.account"]}</span>
            <strong>{context.email}</strong>
          </p>
        ) : null}
        <form action={signOutAdmin}>
          <input
            aria-label={copy["locale.switcher.label"]}
            name="locale"
            type="hidden"
            value={locale}
          />
          <button className="tt-button" type="submit">
            {copy["admin.shared.signOut"]}
          </button>
        </form>
      </section>
    </main>
  );
}
