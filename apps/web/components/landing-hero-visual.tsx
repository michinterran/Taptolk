/**
 * Decorative hero scene for the public landing signal card.
 *
 * Shows the service promise without words: a vehicle with its QR marker,
 * a relayed message traveling through Taptolk, and the owner's reply bubble.
 * Colors come from the design tokens so light/dark surfaces stay consistent.
 */
export function LandingHeroVisual() {
  return (
    <svg
      aria-hidden="true"
      className="landing-signal-card__scene"
      fill="none"
      viewBox="0 0 260 156"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ground */}
      <path
        d="M14 132H246"
        stroke="var(--landing-scene-soft)"
        strokeDasharray="2 7"
        strokeLinecap="round"
        strokeWidth="2"
      />

      {/* vehicle */}
      <path
        d="M24 112c0-5 4-9 9-9h10l9-16c2-3.5 5.5-6 10-6h26c4.5 0 8 2.5 10 6l9 16h10c5 0 9 4 9 9v11c0 3-2.5 5.5-5.5 5.5H29.5c-3 0-5.5-2.5-5.5-5.5v-11Z"
        stroke="var(--landing-scene-line)"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path d="M56 103h38l-7-13H63l-7 13Z" fill="var(--landing-scene-soft)" />
      <circle cx="47" cy="129" r="9" stroke="var(--landing-scene-line)" strokeWidth="2.5" />
      <circle cx="103" cy="129" r="9" stroke="var(--landing-scene-line)" strokeWidth="2.5" />
      <circle cx="47" cy="129" r="3" fill="var(--landing-scene-line)" />
      <circle cx="103" cy="129" r="3" fill="var(--landing-scene-line)" />

      {/* QR marker floating above the vehicle */}
      <path
        d="M75 66l-5.5 8h11L75 66Z"
        fill="var(--tt-color-surface)"
        transform="rotate(180 75 70)"
      />
      <rect fill="var(--tt-color-surface)" height="30" rx="7" width="30" x="60" y="36" />
      <rect fill="var(--tt-color-text)" height="7" rx="1.5" width="7" x="65" y="41" />
      <rect fill="var(--tt-color-text)" height="7" rx="1.5" width="7" x="78" y="41" />
      <rect fill="var(--tt-color-text)" height="7" rx="1.5" width="7" x="65" y="54" />
      <rect fill="var(--tt-color-logo-orange)" height="7" rx="1.5" width="7" x="78" y="54" />

      {/* relayed message path */}
      <path
        d="M96 46C126 20 162 20 192 40"
        stroke="var(--tt-color-logo-orange)"
        strokeDasharray="1 9"
        strokeLinecap="round"
        strokeWidth="3"
      />

      {/* owner reply bubble */}
      <rect fill="var(--tt-color-brand)" height="34" rx="12" width="50" x="192" y="34" />
      <path d="M204 68l7 11 7-11h-14Z" fill="var(--tt-color-brand)" />
      <path
        d="M206 51l7 7 14-14"
        stroke="var(--tt-color-surface)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />

      {/* small privacy sparkles */}
      <circle cx="146" cy="56" r="2.5" fill="var(--landing-scene-soft)" />
      <circle cx="170" cy="66" r="2" fill="var(--landing-scene-soft)" />
    </svg>
  );
}
