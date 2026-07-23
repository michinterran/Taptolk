import type { HTMLAttributes, Key, ReactNode } from "react";
import { SemanticHeading } from "./semantic-heading.js";

type Tone = "default" | "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "muted";

type IconSlot = ReactNode;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function toneClass(base: string, tone: Tone = "default") {
  return tone === "default" ? base : `${base} ${base}--${tone}`;
}

export type AdminShellProps = HTMLAttributes<HTMLDivElement> & {
  sidebar: ReactNode;
  topbar: ReactNode;
};

export function AdminShell({ children, className, sidebar, topbar, ...props }: AdminShellProps) {
  return (
    <div className={cx("tt-admin-shell", className)} {...props}>
      {sidebar}
      <div className="tt-admin-shell__workspace">
        {topbar}
        <main className="tt-admin-shell__main">{children}</main>
      </div>
    </div>
  );
}

export type SidebarItem = {
  current?: boolean;
  href: string;
  icon?: IconSlot;
  label: ReactNode;
};

export type SidebarSection = {
  id?: string;
  items: SidebarItem[];
  label?: ReactNode;
};

export type SidebarProps = HTMLAttributes<HTMLElement> & {
  account?: ReactNode;
  footer?: ReactNode;
  logo: ReactNode;
  sections: SidebarSection[];
};

export function Sidebar({ account, className, footer, logo, sections, ...props }: SidebarProps) {
  return (
    <aside className={cx("tt-sidebar", className)} {...props}>
      <div className="tt-sidebar__brand">{logo}</div>
      <nav className="tt-sidebar__nav">
        {sections.map((section) => (
          <section
            className="tt-sidebar__section"
            key={section.id ?? section.items.map((item) => item.href).join("|")}
          >
            {section.label ? <p className="tt-sidebar__section-label">{section.label}</p> : null}
            <div className="tt-sidebar__items">
              {section.items.map((item) => (
                <a
                  aria-current={item.current ? "page" : undefined}
                  className={cx("tt-sidebar__item", item.current && "tt-sidebar__item--current")}
                  href={item.href}
                  key={item.href}
                >
                  {item.icon ? <span className="tt-sidebar__item-icon">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </nav>
      {account ? <div className="tt-sidebar__account">{account}</div> : null}
      {footer ? <div className="tt-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}

export type TopBarProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  scope?: ReactNode;
  title?: ReactNode;
};

export function TopBar({ actions, className, eyebrow, scope, title, ...props }: TopBarProps) {
  return (
    <header className={cx("tt-topbar", className)} {...props}>
      <div className="tt-topbar__summary">
        {eyebrow ? <p className="tt-topbar__eyebrow">{eyebrow}</p> : null}
        {title ? <div className="tt-topbar__title">{title}</div> : null}
      </div>
      <div className="tt-topbar__actions">
        {scope}
        {actions}
      </div>
    </header>
  );
}

export type ScopeSwitcherItem = {
  description?: ReactNode;
  href: string;
  label: ReactNode;
  selected?: boolean;
};

export type ScopeSwitcherGroup = {
  id?: string;
  items: ScopeSwitcherItem[];
  label: ReactNode;
};

export type ScopeSwitcherProps = HTMLAttributes<HTMLDetailsElement> & {
  disabled?: boolean;
  groups: ScopeSwitcherGroup[];
  icon?: IconSlot;
  label: ReactNode;
};

export function ScopeSwitcher({
  className,
  disabled = false,
  groups,
  icon,
  label,
  ...props
}: ScopeSwitcherProps) {
  return (
    <details
      className={cx("tt-scope-switcher", disabled && "tt-scope-switcher--disabled", className)}
      {...props}
    >
      <summary aria-disabled={disabled || undefined} className="tt-scope-switcher__trigger">
        {icon ? <span className="tt-scope-switcher__icon">{icon}</span> : null}
        <span className="tt-scope-switcher__label">{label}</span>
      </summary>
      {disabled ? null : (
        <div className="tt-scope-switcher__menu">
          {groups.map((group) => (
            <section
              className="tt-scope-switcher__group"
              key={group.id ?? group.items.map((item) => item.href).join("|")}
            >
              <p className="tt-scope-switcher__group-label">{group.label}</p>
              {group.items.map((item) => (
                <a
                  aria-current={item.selected ? "page" : undefined}
                  className={cx(
                    "tt-scope-switcher__item",
                    item.selected && "tt-scope-switcher__item--selected",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <span>{item.label}</span>
                  {item.description ? <small>{item.description}</small> : null}
                </a>
              ))}
            </section>
          ))}
        </div>
      )}
    </details>
  );
}

export type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  level?: 1 | 2 | 3;
  lines: readonly [string, ...string[]];
};

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  level = 1,
  lines,
  ...props
}: PageHeaderProps) {
  return (
    <section className={cx("tt-page-header", className)} {...props}>
      <div className="tt-page-header__copy">
        {eyebrow ? <p className="tt-page-header__eyebrow">{eyebrow}</p> : null}
        <SemanticHeading
          as={`h${level}` as "h1" | "h2" | "h3"}
          className="tt-page-header__title"
          lines={lines}
        />
        {description ? <p className="tt-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="tt-page-header__actions">{actions}</div> : null}
    </section>
  );
}

export type StatTileProps = HTMLAttributes<HTMLElement> & {
  badge?: ReactNode;
  delta?: ReactNode;
  icon?: IconSlot;
  label: ReactNode;
  tone?: Tone;
  value: ReactNode;
};

export function StatTile({
  badge,
  className,
  delta,
  icon,
  label,
  tone,
  value,
  ...props
}: StatTileProps) {
  return (
    <article className={cx(toneClass("tt-stat-tile", tone), className)} {...props}>
      <div className="tt-stat-tile__header">
        <span className="tt-stat-tile__label">{label}</span>
        {icon ? <span className="tt-stat-tile__icon">{icon}</span> : null}
      </div>
      <div className="tt-stat-tile__value">{value}</div>
      {delta || badge ? (
        <div className="tt-stat-tile__meta">
          {delta ? <span>{delta}</span> : null}
          {badge ? <span>{badge}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export type StatStripProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 4 | 6;
};

export function StatStrip({ children, className, columns = 6, ...props }: StatStripProps) {
  return (
    <div className={cx("tt-stat-strip", `tt-stat-strip--${columns}`, className)} {...props}>
      {children}
    </div>
  );
}

export type FilterBarProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  filters?: ReactNode;
  search?: ReactNode;
};

export function FilterBar({ actions, className, filters, search, ...props }: FilterBarProps) {
  return (
    <div className={cx("tt-filter-bar", className)} {...props}>
      {search ? <div className="tt-filter-bar__search">{search}</div> : null}
      {filters ? <div className="tt-filter-bar__filters">{filters}</div> : null}
      {actions ? <div className="tt-filter-bar__actions">{actions}</div> : null}
    </div>
  );
}

export type DataTableColumn<T> = {
  align?: "left" | "center" | "right";
  cell: (row: T) => ReactNode;
  header: ReactNode;
  key: string;
};

export type DataTableProps<T> = HTMLAttributes<HTMLDivElement> & {
  columns: Array<DataTableColumn<T>>;
  empty?: ReactNode;
  getRowKey: (row: T, index: number) => Key;
  rows: readonly T[];
};

export function DataTable<T>({
  className,
  columns,
  empty,
  getRowKey,
  rows,
  ...props
}: DataTableProps<T>) {
  return (
    <div className={cx("tt-data-table-wrap", className)} {...props}>
      <table className="tt-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th data-align={column.align ?? "left"} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td data-align={column.align ?? "left"} key={column.key}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="tt-data-table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ children, className, tone, ...props }: BadgeProps) {
  return (
    <span className={cx(toneClass("tt-badge", tone), className)} {...props}>
      {children}
    </span>
  );
}

export type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  dot?: boolean;
  tone?: Tone;
};

export function StatusPill({ children, className, dot = true, tone, ...props }: StatusPillProps) {
  return (
    <span className={cx(toneClass("tt-status-pill", tone), className)} {...props}>
      {dot ? <span aria-hidden="true" className="tt-status-pill__dot" /> : null}
      {children}
    </span>
  );
}

export type MeterBarProps = HTMLAttributes<HTMLDivElement> & {
  max?: number;
  tone?: Tone;
  value: number;
};

export function MeterBar({ className, max = 100, tone, value, ...props }: MeterBarProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cx(toneClass("tt-meter", tone), className)} {...props}>
      <span className="tt-meter__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

export type PaginationProps = HTMLAttributes<HTMLElement> & {
  next?: ReactNode;
  previous?: ReactNode;
  summary: ReactNode;
};

export function Pagination({ className, next, previous, summary, ...props }: PaginationProps) {
  return (
    <nav className={cx("tt-pagination", className)} {...props}>
      <div className="tt-pagination__controls">
        {previous}
        {next}
      </div>
      <p className="tt-pagination__summary">{summary}</p>
    </nav>
  );
}

export type SideCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  title?: ReactNode;
};

export function SideCard({ actions, children, className, title, ...props }: SideCardProps) {
  return (
    <aside className={cx("tt-side-card", className)} {...props}>
      {title || actions ? (
        <div className="tt-side-card__header">
          {title ? <h3>{title}</h3> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </aside>
  );
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  icon?: IconSlot;
  title: ReactNode;
};

export function EmptyState({
  actions,
  className,
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cx("tt-empty-state", className)} {...props}>
      {icon ? <div className="tt-empty-state__icon">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="tt-empty-state__actions">{actions}</div> : null}
    </div>
  );
}

export type FooterProps = HTMLAttributes<HTMLElement> & {
  links?: ReactNode;
  meta?: ReactNode;
};

export function Footer({ children, className, links, meta, ...props }: FooterProps) {
  return (
    <footer className={cx("tt-footer", className)} {...props}>
      <div>{children}</div>
      {links || meta ? (
        <div className="tt-footer__meta">
          {links}
          {meta}
        </div>
      ) : null}
    </footer>
  );
}

export type AuthCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

export function AuthCard({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: AuthCardProps) {
  return (
    <section className={cx("tt-auth-card", className)} {...props}>
      <div className="tt-auth-card__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
      {actions ? <div className="tt-auth-card__actions">{actions}</div> : null}
    </section>
  );
}

export type StepperStep = {
  description?: ReactNode;
  id?: string;
  label: ReactNode;
  status?: "complete" | "current" | "upcoming";
};

export type StepperProps = HTMLAttributes<HTMLOListElement> & {
  steps: StepperStep[];
};

export function Stepper({ className, steps, ...props }: StepperProps) {
  return (
    <ol className={cx("tt-stepper", className)} {...props}>
      {steps.map((step, index) => (
        <li
          className={cx("tt-stepper__step", step.status && `tt-stepper__step--${step.status}`)}
          key={step.id ?? String(step.label)}
        >
          <span className="tt-stepper__index">{index + 1}</span>
          <span className="tt-stepper__copy">
            <span>{step.label}</span>
            {step.description ? <small>{step.description}</small> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
