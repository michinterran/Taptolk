import type {
  QrInventoryAssignmentAssetItem,
  QrInventoryAssignmentReadModel,
} from "@taptolk/application";

export type QrSiteOperationsSection = "production" | "inventory" | "assignment" | "exceptions";

export type QrDeliveryStatus = "DELIVERED" | "PRINTED" | "SENT_TO_PRINTER" | "SHIPPED";

export type QrActivationReadiness =
  | "ACTIVE"
  | "BLOCKED"
  | "PENDING"
  | "READY"
  | "WAITING_FOR_RECEIPT";

export interface QrActivationSummary {
  active: number;
  blocked: number;
  pending: number;
  ready: number;
  waitingForReceipt: number;
}

const SECTIONS: readonly QrSiteOperationsSection[] = [
  "production",
  "inventory",
  "assignment",
  "exceptions",
];

const MANAGED_ASSET_STATUSES = new Set<QrInventoryAssignmentAssetItem["status"]>([
  "ASSIGNED",
  "ACTIVATION_PENDING",
  "ACTIVE",
  "SUSPENDED",
  "LOST",
  "DAMAGED",
]);

export function readQrSiteOperationsSection(value: string | undefined): QrSiteOperationsSection {
  return SECTIONS.includes(value as QrSiteOperationsSection)
    ? (value as QrSiteOperationsSection)
    : "production";
}

export function getNextQrDeliveryStatus(status: string): QrDeliveryStatus | null {
  if (status === "PRINT_FILE_READY") return "SENT_TO_PRINTER";
  if (status === "SENT_TO_PRINTER") return "PRINTED";
  if (status === "PRINTED") return "SHIPPED";
  if (status === "SHIPPED") return "DELIVERED";
  return null;
}

export function getQrActivationReadiness(
  status: QrInventoryAssignmentAssetItem["status"],
): QrActivationReadiness {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "ACTIVATION_PENDING") return "PENDING";
  if (status === "IN_STOCK" || status === "ASSIGNED") return "READY";
  if (status === "GENERATED" || status === "PRINT_READY" || status === "PRINTED") {
    return "WAITING_FOR_RECEIPT";
  }
  return "BLOCKED";
}

export function getQrActivationSummary(model: QrInventoryAssignmentReadModel): QrActivationSummary {
  const summary: QrActivationSummary = {
    active: 0,
    blocked: 0,
    pending: 0,
    ready: 0,
    waitingForReceipt: 0,
  };
  for (const asset of model.assets) {
    const readiness = getQrActivationReadiness(asset.status);
    if (readiness === "ACTIVE") summary.active += 1;
    else if (readiness === "PENDING") summary.pending += 1;
    else if (readiness === "READY") summary.ready += 1;
    else if (readiness === "WAITING_FOR_RECEIPT") summary.waitingForReceipt += 1;
    else summary.blocked += 1;
  }
  return summary;
}

export function getStockAssets(
  model: QrInventoryAssignmentReadModel,
): readonly QrInventoryAssignmentAssetItem[] {
  return model.assets.filter((asset) => asset.status === "IN_STOCK");
}

export function getManagedAssets(
  model: QrInventoryAssignmentReadModel,
): readonly QrInventoryAssignmentAssetItem[] {
  return model.assets.filter((asset) => MANAGED_ASSET_STATUSES.has(asset.status));
}
