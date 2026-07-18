import { JourneyStatus, SemanticHeading } from "@taptolk/ui";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "../../components/locale-switcher";
import { getMessages } from "../../content/messages";
import { isAppLocale } from "../../i18n/locale";

export default async function FoundationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const foundationCards = [
    {
      description: copy["foundation.card.modular.description"],
      index: "01",
      title: copy["foundation.card.modular.title"],
    },
    {
      description: copy["foundation.card.standard.description"],
      index: "02",
      title: copy["foundation.card.standard.title"],
    },
    {
      description: copy["foundation.card.trust.description"],
      index: "03",
      title: copy["foundation.card.trust.title"],
    },
  ] as const;

  return (
    <main className="foundation-shell">
      <header className="brand-header">
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img
          alt={copy["foundation.logo.alt"]}
          className="brand-logo"
          height="405"
          src="/brand/taptolk-logo.png"
          width="1000"
        />
        <div className="header-controls">
          <LocaleSwitcher
            currentLocale={locale}
            labels={{
              en: copy["locale.english"],
              ko: copy["locale.korean"],
            }}
            pathname={`/${locale}`}
            title={copy["locale.switcher.label"]}
          />
          <div className="phase-marker">
            <span>{copy["foundation.phase.label"]}</span>
            <strong>{copy["foundation.phase.value"]}</strong>
          </div>
        </div>
      </header>

      <section aria-labelledby="foundation-title" className="foundation-hero">
        <p className="eyebrow">{copy["foundation.eyebrow"]}</p>
        <SemanticHeading
          className="hero-title"
          id="foundation-title"
          lines={[copy["foundation.hero.line1"], copy["foundation.hero.line2"]]}
        />
        <p className="hero-description">{copy["foundation.hero.description"]}</p>

        <JourneyStatus
          description={copy["foundation.status.description"]}
          state="waiting"
          title={copy["foundation.status.title"]}
        />
      </section>

      <section className="foundation-grid">
        {foundationCards.map((card) => (
          <article className="foundation-card" key={card.index}>
            <span aria-hidden="true" className="foundation-card__index">
              {card.index}
            </span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
