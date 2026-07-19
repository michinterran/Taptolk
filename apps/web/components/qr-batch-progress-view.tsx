import type { QrBatchProgressItem, QrBatchStatus } from "@taptolk/application";

export function QrBatchProgressView({
  copy,
  items,
}: {
  copy: {
    attempts: string;
    empty: string;
    exports: string;
    failed: string;
    generated: string;
    progress: string;
    statusLabels: Readonly<Record<QrBatchStatus, string>>;
    title: string;
  };
  items: readonly QrBatchProgressItem[];
}) {
  return (
    <section aria-labelledby="qr-batch-progress-title" className="admin-lifecycle-queue">
      <header>
        <h2 id="qr-batch-progress-title">{copy.title}</h2>
        <p>{copy.progress}</p>
      </header>
      {items.length > 0 ? (
        <div className="admin-approval-list">
          {items.map((item) => (
            <article className="admin-approval-card" key={item.id}>
              <header className="admin-approval-card__header">
                <div>
                  <span className="admin-approval-card__label">{item.batchCode}</span>
                  <h3>{item.siteName}</h3>
                </div>
                <span className="admin-status-badge">{copy.statusLabels[item.status]}</span>
              </header>
              <label className="admin-field" htmlFor={`batch-progress-${item.id}`}>
                <span>
                  {copy.generated} · {item.generatedQuantity.toLocaleString()} /{" "}
                  {item.requestedQuantity.toLocaleString()}
                </span>
                <progress
                  id={`batch-progress-${item.id}`}
                  max={item.requestedQuantity}
                  value={item.generatedQuantity}
                />
              </label>
              <dl className="admin-approval-meta">
                <div>
                  <dt>{copy.failed}</dt>
                  <dd>{item.failedQuantity.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{copy.attempts}</dt>
                  <dd>{item.executionAttemptCount ?? 0}</dd>
                </div>
                <div>
                  <dt>{copy.exports}</dt>
                  <dd>{item.exportTypes.length > 0 ? item.exportTypes.join(" · ") : "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-catalog-read-only">{copy.empty}</p>
      )}
    </section>
  );
}
