import { SemanticHeading } from "@taptolk/ui";
import { notFound } from "next/navigation";
import { LandingHeroVisual } from "../../../components/landing-hero-visual";
import { PublicSiteHeader } from "../../../components/public-site-header";
import { getMessages } from "../../../content/messages";
import { isAppLocale } from "../../../i18n/locale";

/**
 * Public introduction for people who scan a Taptolk QR and for vehicle owners who
 * received a sticker.
 *
 * This page carries no sign-in, sign-up, or administrator link, and offers no control
 * that looks like it could start a request without an issued QR: contact always begins
 * from the token-bearing `/{locale}/q/{token}` address printed on the sticker.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);

  const callerSteps = [
    {
      description: copy["landing.usage.step1.description"],
      index: "01",
      title: copy["landing.usage.step1.title"],
    },
    {
      description: copy["landing.usage.step2.description"],
      index: "02",
      title: copy["landing.usage.step2.title"],
    },
    {
      description: copy["landing.usage.step3.description"],
      index: "03",
      title: copy["landing.usage.step3.title"],
    },
  ] as const;

  const ownerSteps = [
    {
      description: copy["landing.owner.step1.description"],
      index: "01",
      title: copy["landing.owner.step1.title"],
    },
    {
      description: copy["landing.owner.step2.description"],
      index: "02",
      title: copy["landing.owner.step2.title"],
    },
    {
      description: copy["landing.owner.step3.description"],
      index: "03",
      title: copy["landing.owner.step3.title"],
    },
    {
      description: copy["landing.owner.step4.description"],
      index: "04",
      title: copy["landing.owner.step4.title"],
    },
  ] as const;

  const privacyPoints = [
    copy["landing.privacy.numbers"],
    copy["landing.privacy.purpose"],
    copy["landing.privacy.temporary"],
    copy["landing.privacy.control"],
  ] as const;

  const faqEntries = [
    { answer: copy["landing.faq.app.answer"], question: copy["landing.faq.app.question"] },
    { answer: copy["landing.faq.phone.answer"], question: copy["landing.faq.phone.question"] },
    { answer: copy["landing.faq.noqr.answer"], question: copy["landing.faq.noqr.question"] },
    { answer: copy["landing.faq.reply.answer"], question: copy["landing.faq.reply.question"] },
    {
      answer: copy["landing.faq.emergency.answer"],
      question: copy["landing.faq.emergency.question"],
    },
    { answer: copy["landing.faq.report.answer"], question: copy["landing.faq.report.question"] },
  ] as const;

  return (
    <main className="landing-shell">
      <PublicSiteHeader
        currentLocale={locale}
        labels={{
          en: copy["locale.english"],
          faq: copy["landing.nav.faq"],
          ko: copy["locale.korean"],
          navigation: copy["landing.nav.label"],
          privacy: copy["landing.nav.privacy"],
          usage: copy["landing.nav.usage"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["landing.logo.alt"]}
        pathname={`/${locale}`}
      />

      <section aria-labelledby="landing-title" className="landing-hero">
        <div className="landing-hero__copy">
          <p className="eyebrow">{copy["landing.eyebrow"]}</p>
          <SemanticHeading
            className="landing-title"
            id="landing-title"
            lines={[copy["landing.hero.line1"], copy["landing.hero.line2"]]}
          />
          <p className="landing-description">{copy["landing.hero.description"]}</p>
          <div className="landing-actions">
            <a className="tt-button landing-primary" href="#how-it-works">
              {copy["landing.hero.primary"]}
            </a>
          </div>
        </div>

        <aside aria-hidden="true" className="landing-signal-card">
          <LandingHeroVisual />
        </aside>
      </section>

      <section aria-labelledby="how-it-works-title" className="landing-journey" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow">{copy["landing.usage.label"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="how-it-works-title"
            lines={[copy["landing.usage.line1"], copy["landing.usage.line2"]]}
          />
        </div>
        <ol className="landing-route">
          {callerSteps.map((step) => (
            <li key={step.index}>
              <div className="landing-route__meta">
                <span>{step.index}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="owner-title" className="landing-journey landing-journey--owner">
        <div className="landing-section-heading">
          <p className="eyebrow">{copy["landing.owner.label"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="owner-title"
            lines={[copy["landing.owner.line1"], copy["landing.owner.line2"]]}
          />
        </div>
        <ol className="landing-route landing-route--owner">
          {ownerSteps.map((step) => (
            <li key={step.index}>
              <div className="landing-route__meta">
                <span>{step.index}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="privacy-title" className="landing-privacy" id="privacy">
        <div className="landing-section-heading landing-section-heading--compact">
          <p className="eyebrow">{copy["landing.privacy.eyebrow"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="privacy-title"
            lines={[copy["landing.privacy.line1"], copy["landing.privacy.line2"]]}
          />
        </div>
        <ul className="landing-privacy-list">
          {privacyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-title" className="landing-faq" id="faq">
        <div className="landing-section-heading landing-section-heading--compact">
          <p className="eyebrow">{copy["landing.nav.faq"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="faq-title"
            lines={[copy["landing.faq.line1"], copy["landing.faq.line2"]]}
          />
        </div>
        <dl aria-label={copy["landing.faq.label"]} className="landing-faq-list">
          {faqEntries.map((entry) => (
            <div className="landing-faq-item" key={entry.question}>
              <dt>{entry.question}</dt>
              <dd>{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="landing-footer">
        <span>{copy["landing.footer"]}</span>
      </footer>
    </main>
  );
}
