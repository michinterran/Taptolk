/**
 * QR sticker order quantity policy.
 *
 * A single QR batch is contractually capped at {@link QR_BATCH_ITEM_MAX} items.
 * A larger order is split into whole batches instead of relaxing that cap, so the
 * UI never has to hide the split from the operator.
 *
 * Everything here is pure arithmetic over the caller's own numbers. When a site
 * has no contract vehicle limit recorded, contract-derived values resolve to
 * `null` rather than a guess.
 */

/** Contractual maximum item count for one batch. Do not raise without a quantity-policy approval. */
export const QR_BATCH_ITEM_MAX = 100;
/** Smallest submittable order. `0` is allowed while editing, but not on submit. */
export const QR_BATCH_TOTAL_MIN = 1;
/** Upper bound for one order series, across all of its child batches. */
export const QR_BATCH_SERIES_TOTAL_MAX = 10_000;
/** Assumed generation throughput used for the estimate shown on the quantity step. */
export const QR_BATCH_ITEMS_PER_MINUTE = 60;
/** Full batches drawn individually before the rest collapse into a single marker. */
export const QR_BATCH_SEGMENT_DISPLAY_MAX = 8;
/** Slider headroom over the contract size, so the handle is not pinned at the contract value. */
const SLIDER_CONTRACT_HEADROOM = 1.5;
const SLIDER_STEP = 10;

export type QrCapacitySignal = "NONE" | "FILLS_CONTRACT" | "OVER_CONTRACT";

export type QrBatchPresetKind = "FIXED" | "CONTRACT" | "CONTRACT_DOUBLE";

export interface QrBatchPreset {
  kind: QrBatchPresetKind;
  value: number;
}

/**
 * Snap suggestions for the remainder. `ALIGNED` means every batch is already full.
 * `ADJUSTABLE` offers the two one-click totals that remove the partial batch.
 */
export type QrBatchSnap =
  | { kind: "ALIGNED" }
  | { downBy: number; downTo: number; kind: "ADJUSTABLE"; upBy: number; upTo: number };

export interface QrBatchSegments {
  /** Full batches rendered as individual segments. */
  drawn: number;
  /** Full batches folded into a `…×N` marker. */
  collapsed: number;
  /** Item count of the trailing partial batch, or `null` when the split is exact. */
  partial: number | null;
}

export interface QrSiteCapacity {
  /** Contracted vehicle limit for the site. `null` when the site has no contract size recorded. */
  contractVehicleLimit: number | null;
  /** QR assets already in stock but not yet assigned to a vehicle. */
  unassignedStock: number;
}

export interface QrBatchPlan {
  total: number;
  /** Number of batches the order splits into. `0` when the total is `0`. */
  batchCount: number;
  fullBatchCount: number;
  /** Items in the final batch, or `null` when the total is `0`. */
  lastBatchSize: number | null;
  perBatchMax: number;
  segments: QrBatchSegments;
  snap: QrBatchSnap | null;
  /** Upper bound for the range input. Always at least `total`, so the slider can display it. */
  sliderMax: number;
  /** `contractVehicleLimit − unassignedStock`, or `null` without a contract size. */
  recommendedTotal: number | null;
  presets: readonly QrBatchPreset[];
  capacitySignal: QrCapacitySignal;
  /** Items ordered beyond the contract size. `0` unless the signal is `OVER_CONTRACT`. */
  overBy: number;
  estimatedMinutes: number | null;
}

/** Clamps free-form input to a whole number inside the allowed series range. */
export function clampQrBatchTotal(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(QR_BATCH_SERIES_TOTAL_MAX, Math.floor(value)));
}

function normalizeCapacity(capacity: QrSiteCapacity): {
  limit: number | null;
  stock: number;
} {
  const rawLimit = capacity.contractVehicleLimit;
  const limit =
    rawLimit !== null && Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : null;
  const rawStock = capacity.unassignedStock;
  const stock = Number.isFinite(rawStock) && rawStock > 0 ? Math.floor(rawStock) : 0;
  return { limit, stock };
}

/**
 * Derives the slider bound from the contract size, then grows it when a larger total is
 * typed. Without this the handle would sit at the maximum while the input showed a
 * different, larger number.
 */
function resolveSliderMax(total: number, limit: number | null): number {
  const base =
    limit === null
      ? QR_BATCH_ITEM_MAX
      : Math.max(
          QR_BATCH_ITEM_MAX,
          Math.ceil((limit * SLIDER_CONTRACT_HEADROOM) / SLIDER_STEP) * SLIDER_STEP,
        );
  return total > base ? Math.ceil(total / QR_BATCH_ITEM_MAX) * QR_BATCH_ITEM_MAX : base;
}

function resolvePresets(
  limit: number | null,
  recommended: number | null,
): readonly QrBatchPreset[] {
  const candidates: readonly QrBatchPreset[] = [
    { kind: "FIXED", value: QR_BATCH_ITEM_MAX },
    ...(limit === null
      ? []
      : ([
          { kind: "CONTRACT", value: limit },
          { kind: "CONTRACT_DOUBLE", value: limit * 2 },
        ] as const)),
  ];
  const seen = new Set<number>(recommended === null ? [] : [recommended]);
  const presets: QrBatchPreset[] = [];
  for (const preset of candidates) {
    if (preset.value <= 0 || preset.value > QR_BATCH_SERIES_TOTAL_MAX || seen.has(preset.value)) {
      continue;
    }
    seen.add(preset.value);
    presets.push(preset);
  }
  return presets;
}

function resolveSegments(fullBatchCount: number, remainder: number): QrBatchSegments {
  const drawn = Math.min(fullBatchCount, QR_BATCH_SEGMENT_DISPLAY_MAX);
  return {
    collapsed: fullBatchCount - drawn,
    drawn,
    partial: remainder > 0 ? remainder : null,
  };
}

function resolveSnap(total: number, fullBatchCount: number, remainder: number): QrBatchSnap | null {
  if (total <= 0) {
    return null;
  }
  if (remainder === 0) {
    return { kind: "ALIGNED" };
  }
  const upBy = QR_BATCH_ITEM_MAX - remainder;
  return {
    downBy: remainder,
    downTo: fullBatchCount * QR_BATCH_ITEM_MAX,
    kind: "ADJUSTABLE",
    upBy,
    upTo: total + upBy,
  };
}

function resolveCapacitySignal(
  total: number,
  limit: number | null,
  stock: number,
): { overBy: number; signal: QrCapacitySignal } {
  if (limit === null || total <= 0) {
    return { overBy: 0, signal: "NONE" };
  }
  if (total > limit) {
    return { overBy: total - limit, signal: "OVER_CONTRACT" };
  }
  if (total + stock > limit) {
    return { overBy: 0, signal: "FILLS_CONTRACT" };
  }
  return { overBy: 0, signal: "NONE" };
}

/**
 * Builds the full quantity-step model for a total against a site's contract capacity.
 * The result is display-ready; it carries no user-facing copy.
 */
export function planQrBatchOrder(rawTotal: number, capacity: QrSiteCapacity): QrBatchPlan {
  const total = clampQrBatchTotal(rawTotal);
  const { limit, stock } = normalizeCapacity(capacity);

  const fullBatchCount = Math.floor(total / QR_BATCH_ITEM_MAX);
  const remainder = total % QR_BATCH_ITEM_MAX;
  const batchCount = fullBatchCount + (remainder > 0 ? 1 : 0);
  const recommendedTotal = limit === null ? null : Math.max(0, limit - stock);
  const { overBy, signal } = resolveCapacitySignal(total, limit, stock);

  return {
    batchCount,
    capacitySignal: signal,
    estimatedMinutes: total <= 0 ? null : Math.max(1, Math.ceil(total / QR_BATCH_ITEMS_PER_MINUTE)),
    fullBatchCount,
    lastBatchSize: total <= 0 ? null : remainder > 0 ? remainder : QR_BATCH_ITEM_MAX,
    overBy,
    perBatchMax: QR_BATCH_ITEM_MAX,
    presets: resolvePresets(limit, recommendedTotal),
    recommendedTotal,
    segments: resolveSegments(fullBatchCount, remainder),
    sliderMax: resolveSliderMax(total, limit),
    snap: resolveSnap(total, fullBatchCount, remainder),
    total,
  };
}
