import type { AppLocale } from "../i18n/config";
import type { QrInventorySection } from "./qr-inventory-sample-view";

export interface QrSectionNavLabels {
  approvals: string;
  approvalsHint: string;
  order: string;
  orderHint: string;
  title: string;
  tracking: string;
  trackingHint: string;
}

/**
 * QR production splits into three areas because the work does, not for visual variety:
 * ordering is one person in one sitting, approval is a different person at a later time
 * (final generation approval is super-admin only), and production tracking spans days to
 * weeks across many batches at once.
 */
export function QrSectionNav({
  labels,
  locale,
  section,
}: {
  labels: QrSectionNavLabels;
  locale: AppLocale;
  section: QrInventorySection;
}) {
  const base = `/${locale}/admin/qr-inventory`;
  const items = [
    { hint: labels.orderHint, href: base, key: "order" as const, label: labels.order },
    {
      hint: labels.approvalsHint,
      href: `${base}?section=approvals`,
      key: "approvals" as const,
      label: labels.approvals,
    },
    {
      hint: labels.trackingHint,
      href: `${base}?section=tracking`,
      key: "tracking" as const,
      label: labels.tracking,
    },
  ];

  return (
    <nav aria-label={labels.title} className="qr-sections">
      {items.map((item) => (
        <a
          aria-current={item.key === section ? "page" : undefined}
          className="qr-sections__item"
          href={item.href}
          key={item.key}
        >
          <strong>{item.label}</strong>
          <small>{item.hint}</small>
        </a>
      ))}
    </nav>
  );
}
