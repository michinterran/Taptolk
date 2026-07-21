import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { loadAdminContext } from "../../../../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { AdminMfaCodeForm } from "../../../../../../components/admin-mfa-code-form";
import { AdminPageHeader } from "../../../../../../components/admin-page-header";
import { getAdminActionErrorMessages } from "../../../../../../content/admin-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

export default async function AdminMfaChallengePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  if (context.status === "LOAD_ERROR") {
    throw new Error("Unable to load MFA challenge state.");
  }
  if (context.decision.state !== "MFA_CHALLENGE_REQUIRED" || !context.verifiedTotpFactorId) {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

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
        pathname={`/${locale}/admin/mfa/challenge`}
      />
      <section className="admin-mfa-layout">
        <div className="admin-auth-intro">
          <p className="eyebrow">{copy["admin.mfa.challenge.eyebrow"]}</p>
          <SemanticHeading
            className="admin-auth-title"
            lines={[copy["admin.mfa.challenge.line1"], copy["admin.mfa.challenge.line2"]]}
          />
          <p className="admin-auth-description">{copy["admin.mfa.challenge.description"]}</p>
        </div>
        <section aria-label={copy["admin.mfa.challenge.eyebrow"]} className="admin-auth-card">
          <AdminMfaCodeForm
            codeLabel={copy["admin.mfa.code.label"]}
            codePlaceholder={copy["admin.mfa.code.placeholder"]}
            errorMessages={getAdminActionErrorMessages(copy)}
            factorId={context.verifiedTotpFactorId}
            locale={locale}
            mode="challenge"
            submitLabel={copy["admin.mfa.verify"]}
            workingLabel={copy["admin.shared.working"]}
          />
        </section>
      </section>
    </main>
  );
}
