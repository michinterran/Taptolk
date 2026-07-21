import type { OperationsDashboardModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import type { CSSProperties } from "react";
import type { AdminRevenueCopy } from "../content/admin-revenue-copy";
import type { AppLocale } from "../i18n/config";

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function AdminRevenueView({
  backHref,
  copy,
  locale,
  model,
}: {
  backHref: string;
  copy: AdminRevenueCopy;
  locale: AppLocale;
  model: OperationsDashboardModel;
}) {
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, {
    currency: "KRW",
    maximumFractionDigits: 0,
    style: "currency",
  });
  const productionReadiness = percent(
    model.completedBatchCount,
    Math.max(model.completedBatchCount + model.openReportCount, 1),
  );
  const providerCompleteness =
    100 - percent(model.notificationMissingCostCount, Math.max(model.notificationSentCount, 1));

  return (
    <div className="operations-shell admin-revenue-shell">
      <a className="operations-back" href={backHref}>
        {copy.back}
      </a>
      <header className="operations-hero admin-revenue-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <SemanticHeading className="operations-title" lines={[copy.line1, copy.line2]} />
        <p>{copy.description}</p>
      </header>

      <section className="admin-revenue-summary" aria-label={copy.eyebrow}>
        <article>
          <span>{copy.activeContracts}</span>
          <strong>{number.format(model.siteCount)}</strong>
          <p>{copy.siteCount}</p>
        </article>
        <article>
          <span>{copy.completedLots}</span>
          <strong>{number.format(model.completedBatchCount)}</strong>
          <p>{copy.qrProduction}</p>
        </article>
        <article>
          <span>{copy.providerCost}</span>
          <strong>{money.format(model.notificationRecordedCost)}</strong>
          <p>{copy.providerCostDescription}</p>
        </article>
        <article>
          <span>{copy.costMissing}</span>
          <strong>{number.format(model.notificationMissingCostCount)}</strong>
          <p>{copy.sent}</p>
        </article>
      </section>

      <section className="admin-revenue-grid">
        <article className="admin-revenue-panel">
          <p className="eyebrow">{copy.contractPipeline}</p>
          <h2>{copy.contractPipelineDescription}</h2>
          <div className="admin-revenue-flow" aria-hidden="true">
            <span>{copy.siteCount}</span>
            <i />
            <span>{copy.qrProduction}</span>
            <i />
            <span>{copy.billingReadiness}</span>
          </div>
        </article>
        <article className="admin-revenue-panel">
          <p className="eyebrow">{copy.qrProduction}</p>
          <h2>{copy.qrProductionDescription}</h2>
          <div className="admin-revenue-meter">
            <span>{productionReadiness}%</span>
            <i
              aria-hidden="true"
              style={{ "--admin-revenue-value": `${productionReadiness}%` } as CSSProperties}
            />
          </div>
        </article>
        <article className="admin-revenue-panel">
          <p className="eyebrow">{copy.billingReadiness}</p>
          <h2>{copy.billingReadinessDescription}</h2>
          <div className="admin-revenue-meter admin-revenue-meter--green">
            <span>{providerCompleteness}%</span>
            <i
              aria-hidden="true"
              style={{ "--admin-revenue-value": `${providerCompleteness}%` } as CSSProperties}
            />
          </div>
        </article>
      </section>

      <aside className="admin-revenue-notice">
        <strong>{copy.billingReadiness}</strong>
        <p>{copy.revenueNotice}</p>
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
