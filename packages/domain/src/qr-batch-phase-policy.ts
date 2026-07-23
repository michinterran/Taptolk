/**
 * QR batch production phases.
 *
 * A batch moves through twenty statuses, which is too many to read as a flat list
 * and too many to show as one linear stepper — a single operator never walks all
 * twenty, because sample approval, final generation approval and receiving belong
 * to different roles.
 *
 * The tracking board groups them into the four phases the work is actually handed
 * off between, plus the terminal outcomes that leave the pipeline. This is a
 * presentation grouping of existing statuses: it introduces no new state, no new
 * transition and no new approval. The transition rules stay in the database.
 */

export const QR_BATCH_PHASES = ["GENERATION", "PRINT", "SHIPPING", "DISTRIBUTION"] as const;

export type QrBatchPhase = (typeof QR_BATCH_PHASES)[number];

/**
 * A batch that ended outside the pipeline. `CANCELLED` and `FAILED` are not a fifth
 * phase — they are outcomes, and a board that files them under a phase would claim
 * work is in progress when it has stopped.
 */
export type QrBatchOutcome = "CANCELLED" | "FAILED";

export type QrBatchPlacement =
  | { kind: "PHASE"; phase: QrBatchPhase }
  | { kind: "OUTCOME"; outcome: QrBatchOutcome };

type TrackedStatus =
  | "DRAFT"
  | "SAMPLE_RENDERING"
  | "SAMPLE_READY"
  | "SAMPLE_APPROVED"
  | "FINAL_APPROVAL_PENDING"
  | "GENERATION_APPROVED"
  | "GENERATION_QUEUED"
  | "GENERATING"
  | "GENERATED"
  | "QUALITY_CHECKED"
  | "PRINT_FILE_READY"
  | "SENT_TO_PRINTER"
  | "PRINTED"
  | "SHIPPED"
  | "DELIVERED"
  | "DISTRIBUTING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "CANCELLED"
  | "FAILED";

const PLACEMENT: Readonly<Record<TrackedStatus, QrBatchPlacement>> = {
  // Everything up to a verified generation output: designing, sampling, both
  // approvals, and the generation run itself.
  DRAFT: { kind: "PHASE", phase: "GENERATION" },
  SAMPLE_RENDERING: { kind: "PHASE", phase: "GENERATION" },
  SAMPLE_READY: { kind: "PHASE", phase: "GENERATION" },
  SAMPLE_APPROVED: { kind: "PHASE", phase: "GENERATION" },
  FINAL_APPROVAL_PENDING: { kind: "PHASE", phase: "GENERATION" },
  GENERATION_APPROVED: { kind: "PHASE", phase: "GENERATION" },
  GENERATION_QUEUED: { kind: "PHASE", phase: "GENERATION" },
  GENERATING: { kind: "PHASE", phase: "GENERATION" },
  GENERATED: { kind: "PHASE", phase: "GENERATION" },
  QUALITY_CHECKED: { kind: "PHASE", phase: "GENERATION" },
  // The print file exists and the order is with the printer.
  PRINT_FILE_READY: { kind: "PHASE", phase: "PRINT" },
  SENT_TO_PRINTER: { kind: "PHASE", phase: "PRINT" },
  PRINTED: { kind: "PHASE", phase: "PRINT" },
  // Physical stickers in transit to the site.
  SHIPPED: { kind: "PHASE", phase: "SHIPPING" },
  DELIVERED: { kind: "PHASE", phase: "SHIPPING" },
  // Received on site and being handed to vehicles.
  DISTRIBUTING: { kind: "PHASE", phase: "DISTRIBUTION" },
  COMPLETED: { kind: "PHASE", phase: "DISTRIBUTION" },
  // Some items were produced and some were not: the batch is still on the board,
  // in the phase where the remainder is handled.
  PARTIALLY_COMPLETED: { kind: "PHASE", phase: "DISTRIBUTION" },
  CANCELLED: { kind: "OUTCOME", outcome: "CANCELLED" },
  FAILED: { kind: "OUTCOME", outcome: "FAILED" },
};

/**
 * Where a status belongs on the tracking board. An unrecognised status is reported
 * as `null` instead of being filed under a phase it may not belong to.
 */
export function getQrBatchPlacement(status: string): QrBatchPlacement | null {
  return PLACEMENT[status as TrackedStatus] ?? null;
}

/** The phase a status sits in, or `null` when it has left the pipeline. */
export function getQrBatchPhase(status: string): QrBatchPhase | null {
  const placement = getQrBatchPlacement(status);
  return placement?.kind === "PHASE" ? placement.phase : null;
}

/** Zero-based position of a phase, for ordering lanes left to right. */
export function getQrBatchPhaseIndex(phase: QrBatchPhase): number {
  return QR_BATCH_PHASES.indexOf(phase);
}

export interface QrBatchLane<T> {
  items: readonly T[];
  phase: QrBatchPhase;
}

export interface QrBatchBoard<T> {
  lanes: readonly QrBatchLane<T>[];
  /** Batches that ended outside the pipeline, newest first in the caller's order. */
  outcomes: readonly { item: T; outcome: QrBatchOutcome }[];
  /** Items whose status this policy does not recognise. Shown rather than dropped. */
  unplaced: readonly T[];
}

/**
 * Split a batch list into the four lanes plus terminal outcomes, preserving the
 * caller's ordering inside each lane. Every lane is present even when empty, so the
 * board keeps its shape instead of collapsing to whatever happens to have data.
 */
export function buildQrBatchBoard<T>(
  items: readonly T[],
  getStatus: (item: T) => string,
): QrBatchBoard<T> {
  const lanes = new Map<QrBatchPhase, T[]>(QR_BATCH_PHASES.map((phase) => [phase, []]));
  const outcomes: { item: T; outcome: QrBatchOutcome }[] = [];
  const unplaced: T[] = [];

  for (const item of items) {
    const placement = getQrBatchPlacement(getStatus(item));
    if (!placement) {
      unplaced.push(item);
      continue;
    }
    if (placement.kind === "OUTCOME") {
      outcomes.push({ item, outcome: placement.outcome });
      continue;
    }
    lanes.get(placement.phase)?.push(item);
  }

  return {
    lanes: QR_BATCH_PHASES.map((phase) => ({ items: lanes.get(phase) ?? [], phase })),
    outcomes,
    unplaced,
  };
}
