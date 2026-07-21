import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { loadAdminContext } from "../../../../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { AdminMfaEnrollment } from "../../../../../../components/admin-mfa-enrollment";
import { AdminPageHeader } from "../../../../../../components/admin-page-header";
import { getAdminActionErrorMessages } from "../../../../../../content/admin-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

export default async function AdminMfaEnrollPage({
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
    throw new Error("Unable to load MFA enrollment state.");
  }
  if (context.decision.state !== "MFA_ENROLL_REQUIRED") {
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
        pathname={`/${locale}/admin/mfa/enroll`}
      />
      <section className="admin-mfa-layout">
        <div className="admin-auth-intro">
          <p className="eyebrow">{copy["admin.mfa.enroll.eyebrow"]}</p>
          <SemanticHeading
            className="admin-auth-title"
            lines={[copy["admin.mfa.enroll.line1"], copy["admin.mfa.enroll.line2"]]}
          />
          <p className="admin-auth-description">{copy["admin.mfa.enroll.description"]}</p>
        </div>
        <section aria-label={copy["admin.mfa.enroll.eyebrow"]} className="admin-auth-card">
          <AdminMfaEnrollment
            beginLabel={copy["admin.mfa.enroll.begin"]}
            codeLabel={copy["admin.mfa.code.label"]}
            codePlaceholder={copy["admin.mfa.code.placeholder"]}
            errorMessages={getAdminActionErrorMessages(copy)}
            locale={locale}
            qrAlt={copy["admin.mfa.enroll.qrAlt"]}
            secretHelp={copy["admin.mfa.enroll.secretHelp"]}
            secretLabel={copy["admin.mfa.enroll.secretLabel"]}
            submitLabel={copy["admin.mfa.verify"]}
            workingLabel={copy["admin.shared.working"]}
          />
        </section>
      </section>
    </main>
  );
}
