import type { QrBatchProgressItem, QrBatchStatus } from "@taptolk/application";
import {
  getQrBatchPhaseIndex,
  getQrBatchPlacement,
  QR_BATCH_PHASES,
  type QrBatchPhase,
} from "@taptolk/domain";
import { StatusPill } from "@taptolk/ui";

function getQrBatchStatusTone(
  status: QrBatchStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "FAILED" || status === "CANCELLED") {
    return "danger";
  }
  if (status === "COMPLETED" || status === "DELIVERED") {
    return "success";
  }
  if (status === "DRAFT") {
    return "neutral";
  }
  if (status === "PARTIALLY_COMPLETED") {
    return "warning";
  }
  return "info";
}

export interface QrBatchProgressCopy {
  attempts: string;
  empty: string;
  exports: string;
  failed: string;
  generated: string;
  outcomes: string;
  progress: string;
  stageLabels: Readonly<Record<QrBatchPhase, string>>;
  stageDone: string;
  stageCurrent: string;
  stageTodo: string;
  statusLabels: Readonly<Record<QrBatchStatus, string>>;
  stopped: string;
  title: string;
}

/**
 * One batch as the canon draws it: a generation bar, then the five production
 * stages in a single vertical line with the reached ones marked.
 *
 * The stage a batch has reached comes from the domain phase policy, so this
 * component never decides what a status means.
 */
function BatchTrack({ copy, item }: { copy: QrBatchProgressCopy; item: QrBatchProgressItem }) {
  const placement = getQrBatchPlacement(item.status);
  const reachedIndex = placement?.kind === "PHASE" ? getQrBatchPhaseIndex(placement.phase) : -1;
  const stopped = placement?.kind === "OUTCOME";
  const generatedPercent =
    item.requestedQuantity > 0
      ? Math.round((item.generatedQuantity / item.requestedQuantity) * 100)
      : null;

  return (
    <article className="qr-track-batch">
      <header className="qr-track-batch__header">
        <div>
          <span className="qr-track-batch__code">{item.batchCode}</span>
          <h4>{item.siteName}</h4>
        </div>
        <StatusPill tone={getQrBatchStatusTone(item.status)}>
          {copy.statusLabels[item.status]}
        </StatusPill>
      </header>

      <div className="qr-track-batch__progress">
        <p>
          <span>{copy.generated}</span>
          <span>
            {item.generatedQuantity.toLocaleString()} / {item.requestedQuantity.toLocaleString()}
          </span>
        </p>
        <span className="qr-progress-bar">
          {/* An unknown ratio draws nothing rather than an empty bar, which reads as zero. */}
          <span style={generatedPercent === null ? undefined : { width: `${generatedPercent}%` }} />
        </span>
        <small>
          {copy.failed} {item.failedQuantity.toLocaleString()} · {copy.attempts}{" "}
          {item.executionAttemptCount ?? 0} · {copy.exports}{" "}
          {item.exportTypes.length > 0 ? item.exportTypes.join(" · ") : "—"}
        </small>
      </div>

      <ol className="qr-track">
        {QR_BATCH_PHASES.map((phase, index) => {
          const state = stopped
            ? "todo"
            : index < reachedIndex
              ? "done"
              : index === reachedIndex
                ? "current"
                : "todo";
          return (
            <li className="qr-track__stage" data-state={state} key={phase}>
              <span aria-hidden="true" className="qr-track__dot">
                {state === "done" ? "✓" : index + 1}
              </span>
              <span>{copy.stageLabels[phase]}</span>
              <span className="qr-track__state">
                {stopped
                  ? copy.stopped
                  : state === "done"
                    ? copy.stageDone
                    : state === "current"
                      ? copy.stageCurrent
                      : copy.stageTodo}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function QrBatchProgressView({
  copy,
  items,
}: {
  copy: QrBatchProgressCopy;
  items: readonly QrBatchProgressItem[];
}) {
  return (
    <section aria-labelledby="qr-batch-progress-title" className="qr-wizard__panel">
      <h2 id="qr-batch-progress-title">{copy.title}</h2>
      <p>{copy.progress}</p>
      {items.length > 0 ? (
        <div className="qr-track-list">
          {items.map((item) => (
            <BatchTrack copy={copy} item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="admin-catalog-read-only">{copy.empty}</p>
      )}
    </section>
  );
}
