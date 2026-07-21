import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties } from "react";
import type { OperationsCopy } from "../content/operations-copy";
import type { AppLocale } from "../i18n/config";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="operations-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function FlowBar({
  label,
  value,
  variant = "violet",
}: {
  label: string;
  value: number;
  variant?: "green" | "orange" | "red" | "violet";
}) {
  return (
    <div className={`operations-flow-bar operations-flow-bar--${variant}`}>
      <span>{label}</span>
      <i aria-hidden="true" style={{ "--operations-flow-value": `${value}%` } as CSSProperties} />
      <strong>{value}%</strong>
    </div>
  );
}

export function OperationsDashboardView({
  backHref,
  copy,
  locale,
  model,
}: {
  backHref: string;
  copy: OperationsCopy;
  locale: AppLocale;
  model: OperationsDashboardModel;
}) {
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
  const responseSeconds =
    model.medianOwnerResponseMs === null
      ? "-"
      : `${decimal.format(model.medianOwnerResponseMs / 1_000)}s`;
  const deliveryBase = Math.max(model.notificationSentCount, 1);
  const contactBase = Math.max(model.contactCount, 1);
  const groups = [
    {
      metrics: [
        [copy.contactCount, number.format(model.contactCount)],
        [copy.unresolved, number.format(model.unresolvedCount)],
        [copy.escalated, number.format(model.escalatedCount)],
        [copy.medianResponse, responseSeconds],
      ],
      title: copy.todayGroup,
    },
    {
      metrics: [
        [copy.sent, number.format(model.notificationSentCount)],
        [copy.retrying, number.format(model.notificationRetryCount)],
        [copy.failed, number.format(model.notificationFailedCount)],
        [copy.cost, decimal.format(model.notificationRecordedCost)],
      ],
      title: copy.deliveryGroup,
    },
    {
      metrics: [
        [copy.openReports, number.format(model.openReportCount)],
        [copy.activeBlocks, number.format(model.activeBlockCount)],
      ],
      title: copy.safetyGroup,
    },
    {
      metrics: [
        [copy.siteCount, number.format(model.siteCount)],
        [copy.activeQr, number.format(model.activeQrCount)],
        [copy.batches, number.format(model.completedBatchCount)],
      ],
      title: copy.inventoryGroup,
    },
  ] as const;

  return (
    <div className="operations-shell">
      <a className="operations-back" href={backHref}>
        {copy.back}
      </a>
      <header className="operations-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <SemanticHeading className="operations-title" lines={[copy.line1, copy.line2]} />
        <p>{copy.description}</p>
      </header>
      <section className="operations-flow-panel" aria-label={copy.todayGroup}>
        <article>
          <h2>{copy.todayGroup}</h2>
          <FlowBar label={copy.contactCount} value={percent(model.contactCount, contactBase)} />
          <FlowBar
            label={copy.unresolved}
            value={percent(model.unresolvedCount, contactBase)}
            variant="orange"
          />
          <FlowBar
            label={copy.escalated}
            value={percent(model.escalatedCount, contactBase)}
            variant="red"
          />
        </article>
        <article>
          <h2>{copy.deliveryGroup}</h2>
          <FlowBar
            label={copy.sent}
            value={100 - percent(model.notificationFailedCount, deliveryBase)}
            variant="green"
          />
          <FlowBar
            label={copy.retrying}
            value={percent(model.notificationRetryCount, deliveryBase)}
            variant="orange"
          />
          <FlowBar
            label={copy.failed}
            value={percent(model.notificationFailedCount, deliveryBase)}
            variant="red"
          />
        </article>
      </section>
      {groups.map((group) => (
        <section className="operations-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="operations-grid">
            {group.metrics.map(([label, value]) => (
              <MetricCard key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      ))}
      {model.notificationMissingCostCount > 0 ? (
        <p className="operations-warning" role="status">
          {number.format(model.notificationMissingCostCount)} {copy.missingCost}
        </p>
      ) : null}
      <aside className="operations-manual">
        <h2>{copy.manualGates}</h2>
        <p>{copy.manualGatesDescription}</p>
      </aside>
      <p className="operations-freshness">
        {copy.freshAt}:{" "}
        <time dateTime={model.freshAt}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "medium",
          }).format(new Date(model.freshAt))}
        </time>
      </p>
    </div>
  );
}
