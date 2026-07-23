import { Buildings, CurrencyKrw, MapPin, QrCode } from "@phosphor-icons/react/dist/ssr";
import type { RevenueCommandCenterModel, RevenueCompanyItem } from "@taptolk/application";
import { DataTable, PageHeader, SideCard, StatStrip, StatTile } from "@taptolk/ui";
import { setMonthlyUnitPrice } from "../admin/revenue-actions";
import type { AdminRevenueCopy } from "../content/admin-revenue-copy";
import type { AppLocale } from "../i18n/config";

export function AdminRevenueView({
  canEdit,
  copy,
  locale,
  model,
}: {
  canEdit: boolean;
  copy: AdminRevenueCopy;
  locale: AppLocale;
  model: RevenueCommandCenterModel;
}) {
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, {
    currency: "KRW",
    maximumFractionDigits: 0,
    style: "currency",
  });
  const companyColumns = [
    {
      cell: (company: RevenueCompanyItem) => company.name,
      header: copy.company,
      key: "company",
    },
    {
      align: "right" as const,
      cell: (company: RevenueCompanyItem) => number.format(company.siteCount),
      header: copy.siteCount,
      key: "sites",
    },
    {
      align: "right" as const,
      cell: (company: RevenueCompanyItem) => number.format(company.activeQrCount),
      header: copy.activeQr,
      key: "activeQr",
    },
    {
      align: "right" as const,
      cell: (company: RevenueCompanyItem) =>
        company.monthlyUnitPriceKrw === null
          ? copy.notSet
          : money.format(company.monthlyUnitPriceKrw),
      header: copy.monthlyUnitPrice,
      key: "unitPrice",
    },
    {
      align: "right" as const,
      cell: (company: RevenueCompanyItem) => money.format(company.projectedMonthlyRevenueKrw),
      header: copy.monthlyProjection,
      key: "projection",
    },
    {
      cell: (company: RevenueCompanyItem) =>
        canEdit ? (
          <details className="admin-row-menu admin-revenue-price-menu">
            <summary>{copy.actions}</summary>
            <form
              action={setMonthlyUnitPrice}
              className="admin-row-menu__popover admin-revenue-price-form"
            >
              <input aria-label={copy.company} name="locale" type="hidden" value={locale} />
              <input
                aria-label={copy.company}
                name="tenantId"
                type="hidden"
                value={company.tenantId}
              />
              <input
                aria-label={copy.company}
                name="managementCompanyId"
                type="hidden"
                value={company.id}
              />
              <label>
                <span>{copy.monthlyUnitPrice}</span>
                <input
                  aria-label={copy.monthlyUnitPrice}
                  defaultValue={company.monthlyUnitPriceKrw ?? 1000}
                  max="1000000"
                  min="0"
                  name="monthlyUnitPriceKrw"
                  required
                  step="1"
                  type="number"
                />
              </label>
              <label>
                <span>{copy.effectiveFrom}</span>
                <input
                  aria-label={copy.effectiveFrom}
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  name="effectiveFrom"
                  required
                  type="date"
                />
              </label>
              <label>
                <span>{copy.reason}</span>
                <textarea
                  aria-label={copy.reason}
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder={copy.reasonPlaceholder}
                  required
                />
              </label>
              <button className="tt-button" type="submit">
                {copy.save}
              </button>
            </form>
          </details>
        ) : (
          copy.notSet
        ),
      header: copy.actions,
      key: "actions",
    },
  ];

  return (
    <div className="operations-shell admin-revenue-command-center">
      <PageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={[copy.line1, copy.line2]}
        actions={
          <dl className="operations-scope-summary">
            <div>
              <dt>{copy.monthlyProjection}</dt>
              <dd>{money.format(model.projectedMonthlyRevenueKrw)}</dd>
            </div>
            <div>
              <dt>{copy.freshAt}</dt>
              <dd>
                <time dateTime={model.freshAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(model.freshAt))}
                </time>
              </dd>
            </div>
          </dl>
        }
      />

      <StatStrip columns={4} aria-label={copy.eyebrow}>
        <StatTile
          delta={`${copy.pricedCompanies}: ${number.format(model.pricedCompanyCount)}`}
          icon={<Buildings aria-hidden="true" size={22} />}
          label={copy.activeContracts}
          value={number.format(model.managementCompanyCount)}
        />
        <StatTile
          delta={`${copy.completedLots}: ${number.format(model.completedBatchCount)}`}
          icon={<MapPin aria-hidden="true" size={22} />}
          label={copy.siteCount}
          value={number.format(model.siteCount)}
        />
        <StatTile
          delta={`${copy.producedStickers}: ${number.format(model.producedStickerCount)}`}
          icon={<QrCode aria-hidden="true" size={22} />}
          label={copy.activeQr}
          value={number.format(model.activeQrCount)}
        />
        <StatTile
          delta={copy.billingReadiness}
          icon={<CurrencyKrw aria-hidden="true" size={22} />}
          label={copy.monthlyProjection}
          value={money.format(model.projectedMonthlyRevenueKrw)}
        />
      </StatStrip>

      <aside className="admin-revenue-notice">
        <strong>{copy.billingReadiness}</strong>
        <p>{copy.revenueNotice}</p>
      </aside>

      <SideCard
        className="admin-revenue-company-panel"
        title={copy.company}
        actions={<strong>{number.format(model.companies.length)}</strong>}
      >
        <p>{copy.contractPipelineDescription}</p>
        <DataTable
          columns={companyColumns}
          getRowKey={(company) => company.id}
          rows={model.companies}
        />
      </SideCard>
    </div>
  );
}
