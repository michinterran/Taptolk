import type { QrBatchProgressItem, QrBatchStatus } from "@taptolk/application";
import { buildQrBatchBoard, type QrBatchPhase } from "@taptolk/domain";
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
  laneEmpty: string;
  laneHints: Readonly<Record<QrBatchPhase, string>>;
  laneLabels: Readonly<Record<QrBatchPhase, string>>;
  outcomes: string;
  outcomesEmpty: string;
  progress: string;
  statusLabels: Readonly<Record<QrBatchStatus, string>>;
  title: string;
  unplaced: string;
}

function BatchTile({ copy, item }: { copy: QrBatchProgressCopy; item: QrBatchProgressItem }) {
  return (
    <article className="qr-board__batch">
      <header className="qr-board__batch-header">
        <div>
          <span className="qr-board__batch-code">{item.batchCode}</span>
          <h4>{item.siteName}</h4>
        </div>
        <StatusPill tone={getQrBatchStatusTone(item.status)}>
          {copy.statusLabels[item.status]}
        </StatusPill>
      </header>
      <label className="qr-board__progress" htmlFor={`batch-progress-${item.id}`}>
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
      <dl className="qr-board__batch-meta">
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
  );
}

/**
 * Production tracking board.
 *
 * Twenty batch statuses do not read as a flat card list, and they are not a single
 * stepper either — the hand-offs belong to different roles. The lanes come from the
 * domain phase policy, so the grouping is not restated here, and every lane renders
 * even when empty so the pipeline keeps its shape.
 */
export function QrBatchProgressView({
  copy,
  items,
}: {
  copy: QrBatchProgressCopy;
  items: readonly QrBatchProgressItem[];
}) {
  const board = buildQrBatchBoard(items, (item) => item.status);

  return (
    <section aria-labelledby="qr-batch-progress-title" className="qr-board">
      <header className="qr-board__header">
        <h2 id="qr-batch-progress-title">{copy.title}</h2>
        <p>{copy.progress}</p>
      </header>
      {items.length > 0 ? (
        <>
          <div className="qr-board__lanes">
            {board.lanes.map((lane) => (
              <section
                aria-label={copy.laneLabels[lane.phase]}
                className="qr-board__lane"
                key={lane.phase}
              >
                <header className="qr-board__lane-header">
                  <h3>{copy.laneLabels[lane.phase]}</h3>
                  <span className="qr-board__lane-count">{lane.items.length}</span>
                  <p>{copy.laneHints[lane.phase]}</p>
                </header>
                {lane.items.length > 0 ? (
                  <div className="qr-board__lane-items">
                    {lane.items.map((item) => (
                      <BatchTile copy={copy} item={item} key={item.id} />
                    ))}
                  </div>
                ) : (
                  <p className="qr-board__lane-empty">{copy.laneEmpty}</p>
                )}
              </section>
            ))}
          </div>
          <section aria-label={copy.outcomes} className="qr-board__outcomes">
            <h3>{copy.outcomes}</h3>
            {board.outcomes.length > 0 ? (
              <div className="qr-board__outcome-items">
                {board.outcomes.map((entry) => (
                  <BatchTile copy={copy} item={entry.item} key={entry.item.id} />
                ))}
              </div>
            ) : (
              <p className="qr-board__lane-empty">{copy.outcomesEmpty}</p>
            )}
          </section>
          {board.unplaced.length > 0 ? (
            <section aria-label={copy.unplaced} className="qr-board__outcomes">
              <h3>{copy.unplaced}</h3>
              <div className="qr-board__outcome-items">
                {board.unplaced.map((item) => (
                  <BatchTile copy={copy} item={item} key={item.id} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="admin-catalog-read-only">{copy.empty}</p>
      )}
    </section>
  );
}
