export const SITE_CONTRACT_VEHICLE_LIMIT_MIN = 1;

function hasValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function hasSiteOperatingAddress(address: string | null | undefined): boolean {
  return hasValue(address) && (address?.trim().length ?? 0) >= 2;
}

export function hasSiteContractCapacity(limit: number | null | undefined): boolean {
  return Number.isInteger(limit) && (limit ?? 0) >= SITE_CONTRACT_VEHICLE_LIMIT_MIN;
}

export type SiteQrReadiness =
  | "INACTIVE"
  | "MISSING_ADDRESS"
  | "MISSING_CONTRACT_CAPACITY"
  | "READY";

export function getSiteQrReadiness(input: {
  address: string | null | undefined;
  contractVehicleLimit: number | null | undefined;
  status: "ACTIVE" | "CLOSED" | "SUSPENDED";
}): SiteQrReadiness {
  if (input.status !== "ACTIVE") {
    return "INACTIVE";
  }
  if (!hasSiteOperatingAddress(input.address)) {
    return "MISSING_ADDRESS";
  }
  return hasSiteContractCapacity(input.contractVehicleLimit)
    ? "READY"
    : "MISSING_CONTRACT_CAPACITY";
}
