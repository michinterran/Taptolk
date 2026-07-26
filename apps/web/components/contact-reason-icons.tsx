import type { ContactReasonCode } from "@taptolk/domain";
import type { ReactNode } from "react";

/**
 * The icon chip on each choice row (docs/design-canon/pwa/01-caller-compose.png).
 *
 * These are marks, not copy — a screen reader gets the row's own text, so every
 * icon is hidden from the accessibility tree. They are drawn here rather than
 * imported so nothing external has to be fetched to render a caller screen.
 */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      {children}
    </svg>
  );
}

const CAR = (
  <Glyph>
    <path d="M5 17h14M6 17V9l2-4h8l2 4v8" />
    <circle cx="8" cy="17" r="1.8" />
    <circle cx="16" cy="17" r="1.8" />
  </Glyph>
);

const MESSAGE = (
  <Glyph>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Glyph>
);

const PHONE = (
  <Glyph>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6.1 6.1l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </Glyph>
);

const HEADLIGHT = (
  <Glyph>
    <circle cx="9" cy="12" r="4" />
    <path d="M15 8h5M15 12h6M15 16h5" />
  </Glyph>
);

const WINDOW = (
  <Glyph>
    <rect height="14" rx="2" width="16" x="4" y="5" />
    <path d="M12 5v14" />
  </Glyph>
);

const ALERT = (
  <Glyph>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Glyph>
);

const IMPACT = (
  <Glyph>
    <path d="m13 2-3 8h5l-3 12 9-13h-5l3-7z" />
  </Glyph>
);

const DOTS = (
  <Glyph>
    <circle cx="6" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18" cy="12" r="1" />
  </Glyph>
);

/**
 * One mark per reason. A code without an entry falls back to the neutral dots
 * rather than to nothing, so a new reason never ships with a hole in the row.
 */
const MARKS: Readonly<Partial<Record<ContactReasonCode, ReactNode>>> = {
  ACCIDENT_CONTACT: IMPACT,
  CONTACT_REQUEST: PHONE,
  DOUBLE_PARKED: CAR,
  EXIT_BLOCKED: CAR,
  LIGHT_ON: HEADLIGHT,
  MOVE_REQUEST: CAR,
  VEHICLE_DAMAGE: ALERT,
  VEHICLE_NOT_MOVING: MESSAGE,
  WINDOW_OPEN: WINDOW,
};

export function reasonIcon(code: ContactReasonCode): ReactNode {
  return MARKS[code] ?? DOTS;
}
