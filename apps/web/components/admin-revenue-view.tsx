import { Buildings, CurrencyKrw, MapPin, QrCode } from "@phosphor-icons/react/dist/ssr";
import type { RevenueCommandCenterModel } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
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

  return (
    <div className="operations-shell admin-revenue-command-center">
      <header className="admin-compact-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <SemanticHeading className="admin-compact-title" lines={[copy.line1, copy.line2]} />
          <p>{copy.description}</p>
        </div>
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
      </header>

      <section className="admin-revenue-kpis" aria-label={copy.eyebrow}>
        <article>
          <Buildings aria-hidden="true" size={22} />
          <span>{copy.activeContracts}</span>
          <strong>{number.format(model.managementCompanyCount)}</strong>
          <small>
            {copy.pricedCompanies}: {number.format(model.pricedCompanyCount)}
          </small>
        </article>
        <article>
          <MapPin aria-hidden="true" size={22} />
          <span>{copy.siteCount}</span>
          <strong>{number.format(model.siteCount)}</strong>
          <small>
            {copy.completedLots}: {number.format(model.completedBatchCount)}
          </small>
        </article>
        <article>
          <QrCode aria-hidden="true" size={22} />
          <span>{copy.activeQr}</span>
          <strong>{number.format(model.activeQrCount)}</strong>
          <small>
            {copy.producedStickers}: {number.format(model.producedStickerCount)}
          </small>
        </article>
        <article>
          <CurrencyKrw aria-hidden="true" size={22} />
          <span>{copy.monthlyProjection}</span>
          <strong>{money.format(model.projectedMonthlyRevenueKrw)}</strong>
          <small>{copy.billingReadiness}</small>
        </article>
      </section>

      <aside className="admin-revenue-notice">
        <strong>{copy.billingReadiness}</strong>
        <p>{copy.revenueNotice}</p>
      </aside>

      <section className="admin-revenue-company-panel" aria-labelledby="revenue-company-title">
        <header>
          <div>
            <h2 id="revenue-company-title">{copy.company}</h2>
            <p>{copy.contractPipelineDescription}</p>
          </div>
          <strong>{number.format(model.companies.length)}</strong>
        </header>
        <div className="admin-command-table-wrap">
          <table className="admin-command-table admin-revenue-company-table">
            <thead>
              <tr>
                <th scope="col">{copy.company}</th>
                <th scope="col">{copy.siteCount}</th>
                <th scope="col">{copy.activeQr}</th>
                <th scope="col">{copy.monthlyUnitPrice}</th>
                <th scope="col">{copy.monthlyProjection}</th>
                <th scope="col">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {model.companies.map((company) => (
                <tr key={company.id}>
                  <th scope="row">{company.name}</th>
                  <td>{number.format(company.siteCount)}</td>
                  <td>{number.format(company.activeQrCount)}</td>
                  <td>
                    {company.monthlyUnitPriceKrw === null
                      ? copy.notSet
                      : money.format(company.monthlyUnitPriceKrw)}
                  </td>
                  <td>{money.format(company.projectedMonthlyRevenueKrw)}</td>
                  <td>
                    {canEdit ? (
                      <details className="admin-row-menu admin-revenue-price-menu">
                        <summary>{copy.actions}</summary>
                        <form
                          action={setMonthlyUnitPrice}
                          className="admin-row-menu__popover admin-revenue-price-form"
                        >
                          <input
                            aria-label={copy.company}
                            name="locale"
                            type="hidden"
                            value={locale}
                          />
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
