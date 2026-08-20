import type { QrBatchStatus, QrOperationsBatch } from "@taptolk/application";
import {
  QR_DIRECT_GENERATION_QUANTITY_MAX,
  QR_DIRECT_GENERATION_QUANTITY_MIN,
} from "@taptolk/application";
import type { Route } from "next";
import type { AppLocale } from "../i18n/config";

export type QrOperationsStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface QrAggregateProgress {
  failed: number;
  generated: number;
  passed: number;
  ready: boolean;
  rendered: number;
  requested: number;
}

export interface QrQuantityPlan {
  batches: number;
  last: number;
}

export type QrOperationsQuery = Record<string, string | number | undefined>;

export function statusTone(status: QrBatchStatus): QrOperationsStatusTone {
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "COMPLETED" || status === "DELIVERED" || status === "GENERATED") {
    return "success";
  }
  if (status === "PARTIALLY_COMPLETED") return "warning";
  if (status === "DRAFT") return "neutral";
  return "info";
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

export function clampQuantity(value: number): number {
  if (!Number.isInteger(value)) return QR_DIRECT_GENERATION_QUANTITY_MIN;
  return Math.min(
    QR_DIRECT_GENERATION_QUANTITY_MAX,
    Math.max(QR_DIRECT_GENERATION_QUANTITY_MIN, value),
  );
}

export function formatAddress(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export function withQuery(locale: AppLocale, params: QrOperationsQuery): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return `/${locale}/admin/qr-inventory?${search.toString()}` as Route;
}

export function batchProgress(batch: QrOperationsBatch): number {
  return percent(batch.generatedQuantity, batch.requestedQuantity);
}

export function formatTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

export function quantityPlan(quantity: number): QrQuantityPlan {
  const batchSize = 100;
  const batches = Math.ceil(quantity / batchSize);
  const last = quantity % batchSize || batchSize;
  return { batches, last };
}

export function aggregateProgress(batches: readonly QrOperationsBatch[]): QrAggregateProgress {
  return batches.reduce<QrAggregateProgress>(
    (memo, batch) => ({
      failed: memo.failed + batch.failedQuantity,
      generated: memo.generated + batch.generatedQuantity,
      passed: memo.passed + batch.passedQuantity,
      ready: memo.ready && batch.downloadReady,
      rendered: memo.rendered + batch.renderedQuantity,
      requested: memo.requested + batch.requestedQuantity,
    }),
    { failed: 0, generated: 0, passed: 0, ready: batches.length > 0, rendered: 0, requested: 0 },
  );
}

export function stepClass(index: number, activeStep: number): string {
  if (index < activeStep) return "is-complete";
  if (index === activeStep) return "is-active";
  return "is-locked";
}

export function isTerminalBatchStatus(status: QrBatchStatus): boolean {
  return ["CANCELLED", "COMPLETED", "DELIVERED", "FAILED", "PARTIALLY_COMPLETED"].includes(status);
}

export function clampPage(value: number, totalPages: number): number {
  if (!Number.isInteger(value)) return 1;
  return Math.min(Math.max(value, 1), totalPages);
}

export function clampPageSize(value: number): 10 | 20 | 50 {
  return value === 20 || value === 50 ? value : 10;
}

export function visiblePages(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function quantityHref(
  locale: AppLocale,
  company: string | undefined,
  site: string | undefined,
  quantity: number,
): Route {
  return withQuery(locale, {
    company,
    confirmed: 1,
    quantity: clampQuantity(quantity),
    site,
  });
}
