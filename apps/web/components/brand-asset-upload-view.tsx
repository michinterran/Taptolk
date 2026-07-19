import type { QrInventorySiteOption } from "@taptolk/application";
import { uploadBrandAsset } from "../admin/brand-asset-actions";
import type { AppLocale } from "../i18n/config";

interface BrandAssetUploadCopy {
  description: string;
  file: string;
  name: string;
  reason: string;
  reasonPlaceholder: string;
  site: string;
  submit: string;
  title: string;
}

export function BrandAssetUploadView({
  copy,
  locale,
  sites,
}: {
  copy: BrandAssetUploadCopy;
  locale: AppLocale;
  sites: readonly QrInventorySiteOption[];
}) {
  return (
    <section aria-labelledby="brand-asset-upload-title" className="admin-lifecycle-queue">
      <header>
        <h2 id="brand-asset-upload-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>
      {sites.length > 0 ? (
        <form action={uploadBrandAsset} className="admin-approval-card">
          <input aria-label="locale" name="locale" type="hidden" value={locale} />
          <label className="admin-field" htmlFor="brand-asset-site">
            <span>{copy.site}</span>
            <select id="brand-asset-site" name="siteScope" required>
              {sites.map((site) => (
                <option
                  key={site.id}
                  value={`${site.tenantId}|${site.managementCompanyId}|${site.id}`}
                >
                  {site.tenantName} / {site.managementCompanyName} / {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" htmlFor="brand-asset-name">
            <span>{copy.name}</span>
            <input id="brand-asset-name" maxLength={200} minLength={1} name="name" required />
          </label>
          <label className="admin-field" htmlFor="brand-asset-file">
            <span>{copy.file}</span>
            <input
              accept=".png,.svg,image/png,image/svg+xml"
              id="brand-asset-file"
              name="brandAsset"
              required
              type="file"
            />
          </label>
          <label className="admin-field" htmlFor="brand-asset-reason">
            <span>{copy.reason}</span>
            <input
              id="brand-asset-reason"
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder={copy.reasonPlaceholder}
              required
            />
          </label>
          <button className="tt-button" type="submit">
            {copy.submit}
          </button>
        </form>
      ) : null}
    </section>
  );
}
