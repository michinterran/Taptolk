import { SemanticHeading } from "@taptolk/ui";
import { notFound } from "next/navigation";
import { LandingHeroVisual } from "../../components/landing-hero-visual";
import { PublicSiteHeader } from "../../components/public-site-header";
import { getMessages } from "../../content/messages";
import { isAppLocale } from "../../i18n/locale";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const journeySteps = [
    {
      description: copy["landing.journey.scan.description"],
      index: "01",
      label: copy["landing.journey.scan.label"],
      title: copy["landing.journey.scan.title"],
    },
    {
      description: copy["landing.journey.send.description"],
      index: "02",
      label: copy["landing.journey.send.label"],
      title: copy["landing.journey.send.title"],
    },
    {
      description: copy["landing.journey.reply.description"],
      index: "03",
      label: copy["landing.journey.reply.label"],
      title: copy["landing.journey.reply.title"],
    },
  ] as const;

  return (
    <main className="landing-shell">
      <PublicSiteHeader
        currentLocale={locale}
        labels={{
          admin: copy["landing.nav.customerAdmin"],
          en: copy["locale.english"],
          guide: copy["landing.nav.guide"],
          ko: copy["locale.korean"],
          navigation: copy["landing.nav.label"],
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
            <a className="tt-button landing-primary" href={`/${locale}/onboarding`}>
              {copy["landing.hero.primary"]}
            </a>
            <a className="landing-text-link" href="#how-it-works">
              {copy["landing.hero.secondary"]}
            </a>
          </div>
          <ul aria-label={copy["landing.trust.label"]} className="landing-trust-list">
            <li>{copy["landing.trust.noPhone"]}</li>
            <li>{copy["landing.trust.noApp"]}</li>
            <li>{copy["landing.trust.purpose"]}</li>
          </ul>
        </div>

        <aside aria-label={copy["landing.signal.label"]} className="landing-signal-card">
          <LandingHeroVisual />
          <p>{copy["landing.signal.kicker"]}</p>
          <strong>{copy["landing.signal.title"]}</strong>
          <span>{copy["landing.signal.description"]}</span>
        </aside>
      </section>

      <section aria-labelledby="journey-title" className="landing-journey" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow">{copy["landing.journey.eyebrow"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="journey-title"
            lines={[copy["landing.journey.line1"], copy["landing.journey.line2"]]}
          />
          <p>{copy["landing.journey.description"]}</p>
        </div>
        <ol className="landing-route">
          {journeySteps.map((step) => (
            <li key={step.index}>
              <div className="landing-route__meta">
                <span>{step.index}</span>
                <small>{step.label}</small>
              </div>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="audience-title" className="landing-audiences">
        <div className="landing-section-heading landing-section-heading--compact">
          <p className="eyebrow">{copy["landing.audiences.eyebrow"]}</p>
          <SemanticHeading
            as="h2"
            className="landing-section-title"
            id="audience-title"
            lines={[copy["landing.audiences.line1"], copy["landing.audiences.line2"]]}
          />
        </div>
        <div className="landing-audience-grid">
          <article className="landing-audience-card landing-audience-card--primary">
            <span>{copy["landing.audiences.caller.badge"]}</span>
            <h2>{copy["landing.audiences.caller.title"]}</h2>
            <p>{copy["landing.audiences.caller.description"]}</p>
            <strong>{copy["landing.audiences.caller.action"]}</strong>
          </article>
          <article className="landing-audience-card">
            <span>{copy["landing.audiences.owner.badge"]}</span>
            <h2>{copy["landing.audiences.owner.title"]}</h2>
            <p>{copy["landing.audiences.owner.description"]}</p>
            <a href={`/${locale}/owner`}>{copy["landing.audiences.owner.action"]}</a>
          </article>
          <article className="landing-audience-card">
            <span>{copy["landing.audiences.customer.badge"]}</span>
            <h2>{copy["landing.audiences.customer.title"]}</h2>
            <p>{copy["landing.audiences.customer.description"]}</p>
            <a href={`/${locale}/admin/login`}>{copy["landing.audiences.customer.action"]}</a>
          </article>
        </div>
      </section>

      <section aria-labelledby="privacy-title" className="landing-privacy">
        <p className="eyebrow">{copy["landing.privacy.eyebrow"]}</p>
        <h2 id="privacy-title">{copy["landing.privacy.title"]}</h2>
        <p>{copy["landing.privacy.description"]}</p>
      </section>

      <footer className="landing-footer">
        <span>{copy["landing.footer"]}</span>
        <a href={`/${locale}/onboarding`}>{copy["landing.hero.primary"]}</a>
      </footer>
    </main>
  );
}
