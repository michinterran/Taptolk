import type { QrOperationsBatch, QrOperationsReadModel } from "@taptolk/application";

export interface QrOperationsScopeSummary {
  activeQr: number;
  completedBatches: number;
  generatedQr: number;
  outputReadyBatches: number;
  pendingActivationQr: number;
  siteCount: number;
  totalBatches: number;
  totalQr: number;
}

const COMPLETED_BATCH_STATUSES = new Set<QrOperationsBatch["status"]>([
  "COMPLETED",
  "DELIVERED",
  "DISTRIBUTING",
]);

export function summarizeQrOperationsScope(
  model: QrOperationsReadModel,
  scope: { managementCompanyId?: string | undefined; siteId?: string | undefined },
): QrOperationsScopeSummary {
  const visibleSites = model.sites.filter((site) => {
    if (scope.siteId) return site.id === scope.siteId;
    if (scope.managementCompanyId) return site.managementCompanyId === scope.managementCompanyId;
    return true;
  });
  const siteIds = new Set(visibleSites.map((site) => site.id));
  const visibleBatches = model.batches.filter((batch) => siteIds.has(batch.siteId));

  return {
    activeQr: visibleSites.reduce((sum, site) => sum + site.activeQr, 0),
    completedBatches: visibleBatches.filter((batch) => COMPLETED_BATCH_STATUSES.has(batch.status))
      .length,
    generatedQr: visibleSites.reduce((sum, site) => sum + site.generatedQr, 0),
    outputReadyBatches: visibleBatches.filter((batch) => batch.downloadReady).length,
    pendingActivationQr: visibleSites.reduce((sum, site) => sum + site.pendingActivationQr, 0),
    siteCount: visibleSites.length,
    totalBatches: visibleBatches.length,
    totalQr: visibleSites.reduce((sum, site) => sum + site.totalQr, 0),
  };
}
