import { describe, expect, it } from "vitest";
import { ADMIN_OVERVIEW_COPY } from "./admin-overview-copy";

describe("administrator overview copy", () => {
  it("keeps Korean and English keys aligned and non-empty", () => {
    const korean = Object.entries(ADMIN_OVERVIEW_COPY.ko);
    const english = Object.entries(ADMIN_OVERVIEW_COPY.en);

    expect(english.map(([key]) => key).sort()).toEqual(korean.map(([key]) => key).sort());
    for (const [key, value] of [...korean, ...english]) {
      expect(value.trim(), `empty overview copy for ${key}`).not.toBe("");
    }
  });

  it("uses customer-facing navigation language", () => {
    expect(ADMIN_OVERVIEW_COPY.ko.actionCustomers).toBe("계약 고객");
    expect(ADMIN_OVERVIEW_COPY.ko.actionQr).toBe("QR 제작 관리");
    expect(ADMIN_OVERVIEW_COPY.ko.actionOperations).toBe("운영 모니터링");
    expect(Object.values(ADMIN_OVERVIEW_COPY.ko).join(" ")).not.toMatch(/열기/u);
  });
});
