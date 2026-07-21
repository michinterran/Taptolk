import { SemanticHeading } from "@taptolk/ui";
import type { ReactNode } from "react";
import type { MessageDictionary } from "../content/messages";
import type { AppLocale } from "../i18n/config";
import { adminRoute } from "../routing/app-routes";
import { AdminPortalHeader } from "./admin-portal-header";

/**
 * Administrator portal introduction shown to a visitor who is not signed in.
 *
 * It explains the service from a management company's point of view and routes to the
 * existing canonical sign-in and sign-up. It never renders operational data and never
 * lets the browser choose between the customer and platform workspaces: that decision
 * is made on the server after authentication from the approved role and scope.
 *
 * `notice` carries an optional configuration or error state so the introduction stays
 * readable even when the administrator authentication provider is unreachable.
 */
interface AdminPortalIntroProps {
  copy: MessageDictionary;
  locale: AppLocale;
  notice?: ReactNode;
}

export function AdminPortalIntro({ copy, locale, notice }: AdminPortalIntroProps) {
  const workflowSteps = [
    {
      description: copy["portal.workflow.step1.description"],
      index: "01",
      title: copy["portal.workflow.step1.title"],
    },
    {
      description: copy["portal.workflow.step2.description"],
      index: "02",
      title: copy["portal.workflow.step2.title"],
    },
    {
      description: copy["portal.workflow.step3.description"],
      index: "03",
      title: copy["portal.workflow.step3.title"],
    },
    {
      description: copy["portal.workflow.step4.description"],
      index: "04",
      title: copy["portal.workflow.step4.title"],
    },
    {
      description: copy["portal.workflow.step5.description"],
      index: "05",
      title: copy["portal.workflow.step5.title"],
    },
    {
      description: copy["portal.workflow.step6.description"],
      index: "06",
      title: copy["portal.workflow.step6.title"],
    },
    {
      description: copy["portal.workflow.step7.description"],
      index: "07",
      title: copy["portal.workflow.step7.title"],
    },
  ] as const;

  const features = [
    copy["portal.features.sites"],
    copy["portal.features.qr"],
    copy["portal.features.inventory"],
    copy["portal.features.activation"],
    copy["portal.features.contact"],
    copy["portal.features.abuse"],
    copy["portal.features.metrics"],
    copy["portal.features.security"],
  ] as const;

  const approvalPoints = [
    copy["portal.approval.pending"],
    copy["portal.approval.scope"],
    copy["portal.approval.mfa"],
    copy["portal.approval.separation"],
    copy["portal.approval.audit"],
  ] as const;

  return (
    <>
      <AdminPortalHeader
        currentLocale={locale}
        labels={{
          approval: copy["portal.nav.approval"],
          en: copy["locale.english"],
          features: copy["portal.nav.features"],
          flow: copy["portal.nav.flow"],
          ko: copy["locale.korean"],
          login: copy["portal.cta.login"],
          navigation: copy["portal.nav.label"],
          portal: copy["portal.label"],
          signup: copy["portal.cta.signup"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
      />

      {notice ? <div className="admin-portal-notice">{notice}</div> : null}

      <section aria-labelledby="portal-title" className="admin-portal-hero">
        <p className="eyebrow">{copy["portal.intro.eyebrow"]}</p>
        <SemanticHeading
          className="admin-portal-title"
          id="portal-title"
          lines={[copy["portal.hero.line1"], copy["portal.hero.line2"]]}
        />
        <p className="admin-portal-description">{copy["portal.hero.description"]}</p>
        <div className="admin-portal-actions">
          <a className="tt-button admin-portal-primary" href={adminRoute(locale, "/login")}>
            {copy["portal.cta.login"]}
          </a>
          <a className="admin-portal-ghost" href={adminRoute(locale, "/signup")}>
            {copy["portal.cta.signup"]}
          </a>
        </div>
        <p className="admin-portal-signup-note">{copy["portal.signupNote"]}</p>
      </section>

      <section aria-labelledby="workflow-title" className="admin-portal-section" id="workflow">
        <p className="eyebrow">{copy["portal.workflow.eyebrow"]}</p>
        <SemanticHeading
          as="h2"
          className="admin-portal-section-title"
          id="workflow-title"
          lines={[copy["portal.workflow.line1"], copy["portal.workflow.line2"]]}
        />
        <ol aria-label={copy["portal.workflow.label"]} className="admin-portal-steps">
          {workflowSteps.map((step) => (
            <li key={step.index}>
              <span aria-hidden="true">{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" className="admin-portal-section" id="features">
        <p className="eyebrow">{copy["portal.features.eyebrow"]}</p>
        <SemanticHeading
          as="h2"
          className="admin-portal-section-title"
          id="features-title"
          lines={[copy["portal.features.line1"], copy["portal.features.line2"]]}
        />
        <ul aria-label={copy["portal.features.label"]} className="admin-portal-features">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="approval-title" className="admin-portal-section" id="approval">
        <p className="eyebrow">{copy["portal.approval.eyebrow"]}</p>
        <SemanticHeading
          as="h2"
          className="admin-portal-section-title"
          id="approval-title"
          lines={[copy["portal.approval.line1"], copy["portal.approval.line2"]]}
        />
        <ul className="admin-portal-approval">
          {approvalPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <footer className="admin-portal-footer">
        <span>{copy["portal.footer"]}</span>
      </footer>
    </>
  );
}
