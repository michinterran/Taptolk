interface AdminAuthNoticeProps {
  description: string;
  title: string;
  tone?: "danger" | "warning";
}

export function AdminAuthNotice({ description, title, tone = "warning" }: AdminAuthNoticeProps) {
  return (
    <section aria-live="polite" className={`admin-notice admin-notice--${tone}`} role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}
