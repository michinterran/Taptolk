import { SemanticHeading } from "@taptolk/ui";
import { notFound } from "next/navigation";
import { PublicSiteHeader } from "../../../../components/public-site-header";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);

  return (
    <main className="onboarding-shell">
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
        pathname={`/${locale}/onboarding`}
      />

      <section aria-labelledby="onboarding-title" className="onboarding-hero">
        <a className="onboarding-back" href={`/${locale}`}>
          {copy["onboarding.back"]}
        </a>
        <p className="eyebrow">{copy["onboarding.eyebrow"]}</p>
        <SemanticHeading
          className="onboarding-title"
          id="onboarding-title"
          lines={[copy["onboarding.hero.line1"], copy["onboarding.hero.line2"]]}
        />
        <p>{copy["onboarding.hero.description"]}</p>
      </section>

      <section aria-label={copy["onboarding.paths.label"]} className="onboarding-paths">
        <article className="onboarding-path onboarding-path--signal">
          <div>
            <span>{copy["onboarding.caller.kicker"]}</span>
            <strong>{copy["onboarding.caller.badge"]}</strong>
          </div>
          <h2>{copy["onboarding.caller.title"]}</h2>
          <p>{copy["onboarding.caller.description"]}</p>
          <div className="onboarding-path__instruction">
            <span aria-hidden="true">01</span>
            <strong>{copy["onboarding.caller.action"]}</strong>
          </div>
        </article>

        <article className="onboarding-path">
          <div>
            <span>{copy["onboarding.owner.kicker"]}</span>
            <strong>{copy["onboarding.owner.badge"]}</strong>
          </div>
          <h2>{copy["onboarding.owner.title"]}</h2>
          <p>{copy["onboarding.owner.description"]}</p>
          <a className="onboarding-path__link" href={`/${locale}/owner`}>
            {copy["onboarding.owner.action"]}
          </a>
        </article>
      </section>

      <aside className="onboarding-token-note">
        <span aria-hidden="true">QR</span>
        <div>
          <h2>{copy["onboarding.token.title"]}</h2>
          <p>{copy["onboarding.token.description"]}</p>
        </div>
      </aside>

      <footer className="landing-footer">
        <span>{copy["onboarding.footer"]}</span>
        <a href={`/${locale}`}>{copy["onboarding.back"]}</a>
      </footer>
    </main>
  );
}
