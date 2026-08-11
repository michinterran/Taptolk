import type { ManagementCompanyWorkspace } from "@taptolk/application";
import { updateManagementCompany } from "../admin/management-company-actions";
import type { AdminCompanyWorkspaceCopy } from "../content/admin-company-workspace-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyEditViewProps {
  copy: AdminCompanyWorkspaceCopy;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: ManagementCompanyWorkspace;
}

export function ManagementCompanyEditView({
  copy,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
}: ManagementCompanyEditViewProps) {
  const detailPath = `/${locale}/admin/platform/management-companies/${model.id}`;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${detailPath}/edit`}
      />

      <section className="console-settings-page admin-create-panel admin-create-panel--page">
        <header className="console-settings-page__header">
          <div>
            <span className="admin-hierarchy-label">{copy.companyWorkspace}</span>
            <h1>{copy.editCompany}</h1>
            <p>{copy.editCompanyDescription}</p>
          </div>
          <a className="tt-button tt-button--secondary tt-button--compact" href={detailPath}>
            {copy.cancel}
          </a>
        </header>

        <div className="console-settings-layout">
          <nav aria-label={copy.editCompany} className="console-settings-nav">
            <a href="#company-update-basic">{copy.companyInformation}</a>
            <a href="#company-contact-information">{copy.contactInformation}</a>
            <a href="#company-update-operations">{copy.operationsManagerName}</a>
            <a href="#company-update-reason">{copy.changeReason}</a>
          </nav>

          <form action={updateManagementCompany} className="admin-tenant-form admin-company-form">
            <input aria-label="locale" name="locale" type="hidden" value={locale} />
            <input aria-label="return path" name="returnTo" type="hidden" value={detailPath} />
            <input aria-label="company id" name="companyId" type="hidden" value={model.id} />
            <input aria-label="tenant id" name="tenantId" type="hidden" value={model.tenantId} />
            <input
              aria-label="expected version"
              name="expectedVersion"
              type="hidden"
              value={model.version}
            />

            <div className="admin-company-form__section" id="company-update-basic">
              <h2>{copy.companyInformation}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-update-name">
                  <span>{copy.companyName}</span>
                  <input
                    defaultValue={model.name}
                    id="company-update-name"
                    maxLength={200}
                    name="name"
                    required
                  />
                </label>
                <label className="admin-field" htmlFor="company-update-business-number">
                  <span>{copy.businessNumber}</span>
                  <input
                    id="company-update-business-number"
                    inputMode="numeric"
                    name="businessNumber"
                    pattern="[0-9-]*"
                  />
                  <small>{copy.sensitiveUpdateHelp}</small>
                </label>
                <label
                  className="admin-field admin-company-form__wide-field"
                  htmlFor="company-update-address"
                >
                  <span>{copy.address}</span>
                  <input
                    defaultValue={model.address ?? ""}
                    id="company-update-address"
                    maxLength={300}
                    name="address"
                  />
                </label>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-contact-information">
              <h2>{copy.contactInformation}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-update-representative-phone">
                  <span>{copy.representativePhone}</span>
                  <input
                    autoComplete="tel"
                    id="company-update-representative-phone"
                    inputMode="tel"
                    name="representativePhone"
                  />
                  <small>{copy.sensitiveUpdateHelp}</small>
                </label>
                <label className="admin-field" htmlFor="company-update-contact-name">
                  <span>{copy.contactName}</span>
                  <input
                    defaultValue={model.contactName ?? ""}
                    id="company-update-contact-name"
                    maxLength={100}
                    name="contactName"
                  />
                </label>
                <label className="admin-field" htmlFor="company-update-contact-phone">
                  <span>{copy.contactPhone}</span>
                  <input
                    autoComplete="tel"
                    id="company-update-contact-phone"
                    inputMode="tel"
                    name="contactPhone"
                  />
                  <small>{copy.sensitiveUpdateHelp}</small>
                </label>
                <label className="admin-field" htmlFor="company-update-contact-email">
                  <span>{copy.contactEmail}</span>
                  <input
                    autoComplete="email"
                    defaultValue={model.contactEmail ?? ""}
                    id="company-update-contact-email"
                    maxLength={254}
                    name="contactEmail"
                    type="email"
                  />
                </label>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-update-operations">
              <h2>{copy.operationsManagerName}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-update-operations-manager-name">
                  <span>{copy.operationsManagerName}</span>
                  <input
                    defaultValue={model.operationsManagerName ?? ""}
                    id="company-update-operations-manager-name"
                    maxLength={100}
                    name="operationsManagerName"
                  />
                </label>
                <label className="admin-field" htmlFor="company-update-operations-manager-phone">
                  <span>{copy.operationsManagerPhone}</span>
                  <input
                    autoComplete="tel"
                    id="company-update-operations-manager-phone"
                    inputMode="tel"
                    name="operationsManagerPhone"
                  />
                  <small>{copy.sensitiveUpdateHelp}</small>
                </label>
                <label
                  className="admin-field admin-company-form__wide-field"
                  htmlFor="company-update-operations-manager-email"
                >
                  <span>{copy.operationsManagerEmail}</span>
                  <input
                    autoComplete="email"
                    defaultValue={model.operationsManagerEmail ?? ""}
                    id="company-update-operations-manager-email"
                    maxLength={254}
                    name="operationsManagerEmail"
                    type="email"
                  />
                </label>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-update-reason">
              <h2>{copy.changeReason}</h2>
              <label className="admin-field" htmlFor="company-update-reason-input">
                <span>{copy.changeReason}</span>
                <textarea
                  id="company-update-reason-input"
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder={copy.reasonPlaceholder}
                  required
                />
              </label>
            </div>

            <div className="admin-company-form__actions">
              <a className="tt-button tt-button--secondary" href={detailPath}>
                {copy.cancel}
              </a>
              <button className="tt-button" type="submit">
                {copy.save}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
