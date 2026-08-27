import type { HTMLAttributes, ReactNode } from "react";

/**
 * Console page primitives, built from the approved canon
 * (docs/design-canon/console-pages.html and console-detail.html).
 *
 * Screens compose these instead of writing their own markup and CSS. That is the
 * whole point: the console drifted apart because twenty screens each described a
 * panel, a filter bar and a pager in their own words. A screen supplies its
 * columns and its data — never its spacing.
 */

export type ConsoleTone = "brand" | "success" | "warning" | "danger" | "info";

export type ConsoleTab = {
  count?: ReactNode;
  current?: boolean;
  href: string;
  id: string;
  label: ReactNode;
};

function classNames(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/** Primary view tabs: text and an underline, never a pill container. */
export function ConsoleTabs({
  ariaLabel,
  className,
  items,
}: {
  ariaLabel: string;
  className?: string;
  items: readonly ConsoleTab[];
}) {
  return (
    <nav aria-label={ariaLabel} className={classNames("tt-console-tabs", className)}>
      {items.map((item) => (
        <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.id}>
          <span>{item.label}</span>
          {item.count !== undefined ? <small>{item.count}</small> : null}
        </a>
      ))}
    </nav>
  );
}

/** Main column beside a fixed rail. Without a rail, render the children directly. */
export function PageColumns({
  children,
  className,
  rail,
  ...props
}: HTMLAttributes<HTMLDivElement> & { rail?: ReactNode }) {
  if (!rail) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }
  return (
    <div className={classNames("tt-page-columns", className)} {...props}>
      <div>{children}</div>
      {rail}
    </div>
  );
}

/**
 * A panel that owns its edges so a filter bar, table and footer can run to them.
 * Its head carries the title; the body is for anything that is not full-bleed.
 */
export function ConsolePanel({
  breadcrumb,
  children,
  className,
  description,
  headingId,
  actions,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  description?: ReactNode;
  headingId?: string;
  title: ReactNode;
}) {
  return (
    <section className={classNames("tt-panel", className)} {...props}>
      <header className="tt-panel__head">
        <div>
          {breadcrumb ? <p className="tt-panel__breadcrumb">{breadcrumb}</p> : null}
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Padded region inside a panel, for content that is not full-bleed. */
export function PanelBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("tt-panel__body", className)} {...props}>
      {children}
    </div>
  );
}

/** Horizontal scroll container so a wide table never widens the page. */
export function PanelScroll({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("tt-panel__scroll", className)} {...props}>
      {children}
    </div>
  );
}

/** Total on the left, pager on the right, along the panel's bottom edge. */
export function PanelFooter({
  children,
  className,
  total,
  ...props
}: HTMLAttributes<HTMLDivElement> & { total?: ReactNode }) {
  return (
    <div className={classNames("tt-panel__footer", className)} {...props}>
      <p className="tt-panel__total">{total}</p>
      {children}
    </div>
  );
}

/**
 * Two-line table cell: a name with an optional badge, and a quieter second line.
 * Rows in the reference are two lines, not one, which is why the row is 48px.
 */
export function CellEntity({ meta, name }: { meta?: ReactNode; name: ReactNode }) {
  return (
    <span className="tt-cell-entity">
      <strong>{name}</strong>
      {meta ? <small>{meta}</small> : null}
    </span>
  );
}

/**
 * Value above a bar. `percent` is clamped for drawing only — pass `null` when
 * there is nothing to show and the caller renders a dash instead, because an
 * empty bar reads as zero rather than as unknown.
 */
export function Meter({
  label,
  percent,
  tone = "success",
}: {
  label: ReactNode;
  percent: number;
  tone?: Extract<ConsoleTone, "brand" | "success" | "warning" | "danger">;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <span className="tt-meter" data-tone={tone}>
      <span className="tt-meter__value">{label}</span>
      <span className="tt-meter__bar-track">
        <span className="tt-meter__bar" style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

/** The quiet inline link that ends a table row. */
export function RowAction({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a className={classNames("tt-row-action", className)} {...props}>
      {children}
    </a>
  );
}

export interface QueueRowAction {
  form?: ReactNode;
  label: ReactNode;
}

/**
 * One waiting item in the approval rail: what kind, what it is, where it came
 * from and when, then the decision buttons.
 */
export function QueueRow({
  actions,
  icon,
  meta,
  title,
  tone = "info",
}: {
  actions?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
  tone?: Extract<ConsoleTone, "info" | "warning" | "danger">;
}) {
  return (
    <article className="tt-queue-row" data-tone={tone}>
      <div className="tt-queue-row__lead">
        {icon ? (
          <span aria-hidden="true" className="tt-queue-row__icon">
            {icon}
          </span>
        ) : null}
        <span className="tt-queue-row__text">
          <strong>{title}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
      </div>
      {actions ? <div className="tt-queue-row__actions">{actions}</div> : null}
    </article>
  );
}

/** Container for queue rows. */
export function QueueList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("tt-queue-list", className)} {...props}>
      {children}
    </div>
  );
}

/** Two columns of fields with a right-aligned action row. */
export function FormGrid({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("tt-form-grid", className)} {...props}>
      {children}
    </div>
  );
}

export function FormActions({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("tt-form-actions", className)} {...props}>
      {children}
    </div>
  );
}
