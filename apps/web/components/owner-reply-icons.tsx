import type { ReactNode } from "react";

/**
 * The icon chip on each reply row (docs/design-canon/pwa/03-owner-reply.png).
 *
 * Marks, not copy: the row's own text is what a screen reader reads, so each one
 * is hidden from the accessibility tree.
 */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="18"
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

const CLOCK = (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Glyph>
);

const MESSAGE = (
  <Glyph>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Glyph>
);

const OFFICE = (
  <Glyph>
    <path d="M4 21V6l7-3 7 3v15" />
    <path d="M9 21v-5h6v5M9 10h.01M15 10h.01" />
  </Glyph>
);

/** A code without a mark falls back to the message glyph rather than to a hole. */
const MARKS: Readonly<Record<string, ReactNode>> = {
  CANNOT_MOVE_NOW: MESSAGE,
  CONTACT_SITE_OFFICE: OFFICE,
  MOVE_IN_10_MINUTES: CLOCK,
  MOVE_IN_3_MINUTES: CLOCK,
  MOVE_IN_5_MINUTES: CLOCK,
  MOVING_NOW: CAR,
};

export function replyIcon(code: string): ReactNode {
  return MARKS[code] ?? MESSAGE;
}
