import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Mobile primitives for the owner and caller screens, built from the approved
 * canon (docs/design-canon/pwa/ — four mockups plus README.md).
 *
 * The mobile surfaces are a different system from the console: one column of
 * white cards on a near-white ground, a centred logo instead of a title bar,
 * choice rows that are an icon chip plus one line, one full-width primary per
 * screen, and a bottom tab bar whose active item alone is brand-coloured.
 *
 * Screens compose these. A screen supplies its content and its copy — never its
 * spacing, and never a second definition of a card. Every value resolves from a
 * --tt-m-* token and `pnpm validate:design-system` fails when a rule restates one.
 *
 * These components hold no copy. User-facing strings come from the typed locale
 * dictionary (AGENTS.md, Internationalization).
 */

function cx(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/* Shell ---------------------------------------------------------------------- */

export type MobileShellProps = HTMLAttributes<HTMLDivElement> & {
  /** Full-width action area under the stack: one primary, then any links. */
  actions?: ReactNode;
  /** The centred taptolk logo. Always the approved asset, never a redraw. */
  brand?: ReactNode;
  /** Bottom tab bar. Omitted for the caller, who has no account to tab through. */
  tabs?: ReactNode;
};

export function MobileShell({
  actions,
  brand,
  children,
  className,
  tabs,
  ...props
}: MobileShellProps) {
  return (
    <div className={cx("tt-m-shell", className)} {...props}>
      {brand ? <header className="tt-m-shell__header">{brand}</header> : null}
      <div className="tt-m-stack">{children}</div>
      {actions ? <div className="tt-m-shell__actions">{actions}</div> : null}
      {tabs}
    </div>
  );
}

export type MobileTab = {
  active?: boolean;
  href: string;
  icon: ReactNode;
  /** Already localized. */
  label: string;
};

export type MobileTabBarProps = HTMLAttributes<HTMLElement> & {
  /** Localized landmark name for the owner menu. */
  label: string;
  tabs: MobileTab[];
};

export function MobileTabBar({ className, label, tabs, ...props }: MobileTabBarProps) {
  return (
    <nav aria-label={label} className={cx("tt-m-tabbar", className)} {...props}>
      {tabs.map((tab) => (
        <a
          aria-current={tab.active ? "page" : undefined}
          className="tt-m-tab"
          href={tab.href}
          key={tab.href}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}

/* Cards ---------------------------------------------------------------------- */

export type MobileCardProps = HTMLAttributes<HTMLElement> & {
  /** Centres the card's content, as the plate cards in the canon do. */
  center?: boolean;
  /** Muted line above the content, e.g. the received-message label. */
  label?: ReactNode;
  /** Brand outline. The canon uses it for the owner's own reply and nothing else. */
  outlined?: boolean;
};

export function MobileCard({
  center,
  children,
  className,
  label,
  outlined,
  ...props
}: MobileCardProps) {
  return (
    <section
      className={cx(
        "tt-m-card",
        outlined && "tt-m-card--accent",
        center && "tt-m-card--center",
        className,
      )}
      {...props}
    >
      {label ? <span className="tt-m-card__label">{label}</span> : null}
      {children}
    </section>
  );
}

export type PlateProps = HTMLAttributes<HTMLParagraphElement> & {
  /**
   * The plate as it is shown to this reader. Never the raw stored value on a
   * screen that is not the owner's own: use `plate_last4` there (AGENTS.md,
   * Security).
   */
  plate: string;
};

export function Plate({ className, plate, ...props }: PlateProps) {
  return (
    <p className={cx("tt-m-plate", className)} {...props}>
      {plate}
    </p>
  );
}

/* Choice rows ---------------------------------------------------------------- */

export type ChoiceListProps = HTMLAttributes<HTMLUListElement>;

export function ChoiceList({ children, className, ...props }: ChoiceListProps) {
  return (
    <ul className={cx("tt-m-choices", className)} {...props}>
      {children}
    </ul>
  );
}

export type ChoiceRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  /** Small brand line above the label. Never a frequency claim without measurement. */
  eyebrow?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  selected?: boolean;
};

export function ChoiceRow({ className, eyebrow, icon, label, selected, ...props }: ChoiceRowProps) {
  return (
    <li>
      <button
        aria-pressed={selected ?? false}
        className={cx("tt-m-choice", className)}
        type="button"
        {...props}
      >
        {icon ? <span className="tt-m-choice__chip">{icon}</span> : null}
        <span className="tt-m-choice__text">
          {eyebrow ? <span className="tt-m-choice__eyebrow">{eyebrow}</span> : null}
          {label}
        </span>
      </button>
    </li>
  );
}

/* Fields --------------------------------------------------------------------- */

export type MobileFieldProps = HTMLAttributes<HTMLDivElement> & {
  /** `id` of the control this field labels. The control is passed as children. */
  controlId: string;
  hint?: ReactNode;
  /** Set on the hint so the control can point at it with `aria-describedby`. */
  hintId?: string;
  label: ReactNode;
  /**
   * `plate` renders the value at plate size in the brand colour; `code` is the
   * one-time code. Both are still ordinary inputs to a screen reader.
   */
  variant?: "default" | "plate" | "code";
};

export function MobileField({
  children,
  className,
  controlId,
  hint,
  hintId,
  label,
  variant = "default",
  ...props
}: MobileFieldProps) {
  return (
    <div
      className={cx("tt-m-field", variant !== "default" && `tt-m-field--${variant}`, className)}
      {...props}
    >
      <label htmlFor={controlId}>{label}</label>
      {children}
      {hint ? (
        <p className="tt-m-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* Actions -------------------------------------------------------------------- */

export type MobilePrimaryProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The logo mark the canon puts on sending actions and leaves off confirmations. */
  mark?: ReactNode;
};

export function MobilePrimary({
  children,
  className,
  mark,
  type = "button",
  ...props
}: MobilePrimaryProps) {
  return (
    <button className={cx("tt-m-primary", className)} type={type} {...props}>
      {mark}
      {children}
    </button>
  );
}

export function MobileSecondary({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("tt-m-secondary", className)} type={type} {...props}>
      {children}
    </button>
  );
}

export type MobileLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** `quiet` is the muted way out of a step, e.g. "this is not my location". */
  tone?: "accent" | "quiet";
};

export function MobileLink({ children, className, tone = "accent", ...props }: MobileLinkProps) {
  return (
    <a className={cx(tone === "quiet" ? "tt-m-quiet-link" : "tt-m-link", className)} {...props}>
      {children}
    </a>
  );
}

/** Back beside next. Everything else on a mobile screen keeps a single primary. */
export function MobileActions({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("tt-m-actions", className)} {...props}>
      {children}
    </div>
  );
}

/* Readouts ------------------------------------------------------------------- */

export type StatusReadoutProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * "Sent" is not "read" and "read" is not "answered". The caller screen states
   * exactly which event happened (docs/design-canon/pwa/README.md §6).
   */
  label: ReactNode;
  /** Only render when it is measured. A mockup number is not a measurement. */
  meta?: ReactNode;
  status: ReactNode;
};

export function StatusReadout({ className, label, meta, status, ...props }: StatusReadoutProps) {
  return (
    <div aria-live="polite" className={cx("tt-m-status", className)} {...props}>
      <span className="tt-m-status__label">{label}</span>
      <strong className="tt-m-status__value">{status}</strong>
      {meta ? <span className="tt-m-status__meta">{meta}</span> : null}
    </div>
  );
}

export type MobileFact = {
  label: ReactNode;
  /** Absent renders as an em dash. A missing value is never drawn as zero. */
  value?: ReactNode;
};

export type MobileFactsProps = HTMLAttributes<HTMLDListElement> & {
  facts: MobileFact[];
};

export function MobileFacts({ className, facts, ...props }: MobileFactsProps) {
  return (
    <dl className={cx("tt-m-kv", className)} {...props}>
      {facts.map((fact) => (
        <Fragment key={String(fact.label)}>
          <dt>{fact.label}</dt>
          <dd>{fact.value ?? "—"}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export type MobileRow = MobileFact & {
  /** Inline control on the right of the row, e.g. a change or stop button. */
  action?: ReactNode;
};

export type MobileRowsProps = HTMLAttributes<HTMLUListElement> & {
  rows: MobileRow[];
};

/**
 * Facts stacked inside one card, separated by a hairline. The canon never draws
 * a card for each row — that was the box-in-box the console had to unlearn.
 */
export function MobileRows({ className, rows, ...props }: MobileRowsProps) {
  return (
    <ul className={cx("tt-m-rows", className)} {...props}>
      {rows.map((row) => (
        <li key={String(row.label)}>
          <span className="tt-m-rows__label">{row.label}</span>
          <span className="tt-m-rows__value">{row.value ?? "—"}</span>
          {row.action}
        </li>
      ))}
    </ul>
  );
}

export type MobileEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  title: ReactNode;
};

export function MobileEmptyState({
  className,
  description,
  title,
  ...props
}: MobileEmptyStateProps) {
  return (
    <div className={cx("tt-m-empty", className)} {...props}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export type MobileNoticeProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: "muted" | "danger";
};

export function MobileNotice({ children, className, tone = "muted", ...props }: MobileNoticeProps) {
  return (
    <p
      className={cx("tt-m-notice", tone === "danger" && "tt-m-notice--danger", className)}
      role={tone === "danger" ? "alert" : undefined}
      {...props}
    >
      {children}
    </p>
  );
}
