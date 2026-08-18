import type { QrInventoryAssignmentAssetItem } from "@taptolk/application";
import { describe, expect, it } from "vitest";
import {
  getManagedAssets,
  getNextQrDeliveryStatus,
  getQrActivationReadiness,
  getQrActivationSummary,
  getStockAssets,
  readQrSiteOperationsSection,
} from "./qr-site-operations-model";

const asset = (status: QrInventoryAssignmentAssetItem["status"]) =>
  ({ status }) as QrInventoryAssignmentAssetItem;

describe("QR site operations model", () => {
  it("defaults unknown work areas to production", () => {
    expect(readQrSiteOperationsSection(undefined)).toBe("production");
    expect(readQrSiteOperationsSection("unknown")).toBe("production");
    expect(readQrSiteOperationsSection("assignment")).toBe("assignment");
  });

  it("keeps print and delivery progression explicit", () => {
    expect(getNextQrDeliveryStatus("PRINT_FILE_READY")).toBe("SENT_TO_PRINTER");
    expect(getNextQrDeliveryStatus("SENT_TO_PRINTER")).toBe("PRINTED");
    expect(getNextQrDeliveryStatus("PRINTED")).toBe("SHIPPED");
    expect(getNextQrDeliveryStatus("SHIPPED")).toBe("DELIVERED");
    expect(getNextQrDeliveryStatus("DELIVERED")).toBeNull();
  });

  it("separates assignable stock from managed lifecycle assets", () => {
    const model = {
      assets: [asset("IN_STOCK"), asset("ACTIVE"), asset("REVOKED"), asset("DAMAGED")],
      batches: [],
      imports: [],
    };
    expect(getStockAssets(model)).toHaveLength(1);
    expect(getManagedAssets(model).map((item) => item.status)).toEqual(["ACTIVE", "DAMAGED"]);
  });

  it("explains when a sticker can open owner activation", () => {
    expect(getQrActivationReadiness("PRINTED")).toBe("WAITING_FOR_RECEIPT");
    expect(getQrActivationReadiness("IN_STOCK")).toBe("READY");
    expect(getQrActivationReadiness("ASSIGNED")).toBe("READY");
    expect(getQrActivationReadiness("ACTIVATION_PENDING")).toBe("PENDING");
    expect(getQrActivationReadiness("ACTIVE")).toBe("ACTIVE");
    expect(getQrActivationReadiness("REVOKED")).toBe("BLOCKED");
  });

  it("summarizes the activation funnel from the asset read model", () => {
    const model = {
      assets: [
        asset("PRINT_READY"),
        asset("IN_STOCK"),
        asset("ASSIGNED"),
        asset("ACTIVATION_PENDING"),
        asset("ACTIVE"),
        asset("REVOKED"),
      ],
      batches: [],
      imports: [],
    };
    expect(getQrActivationSummary(model)).toEqual({
      active: 1,
      blocked: 1,
      pending: 1,
      ready: 2,
      waitingForReceipt: 1,
    });
  });
});
