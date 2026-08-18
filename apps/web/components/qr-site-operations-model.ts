import type {
  QrInventoryAssignmentAssetItem,
  QrInventoryAssignmentReadModel,
} from "@taptolk/application";

export type QrSiteOperationsSection = "production" | "inventory" | "assignment" | "exceptions";

export type QrDeliveryStatus = "DELIVERED" | "PRINTED" | "SENT_TO_PRINTER" | "SHIPPED";

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
