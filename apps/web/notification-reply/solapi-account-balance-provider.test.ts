import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SolapiSdkAccountBalanceProvider } from "./solapi-account-balance-provider";

describe("SolapiSdkAccountBalanceProvider", () => {
  it("maps only balance fields exposed by the official SDK", async () => {
    const provider = new SolapiSdkAccountBalanceProvider(
      "a".repeat(24),
      "b".repeat(24),
      vi.fn().mockResolvedValue({
        balance: 2_500,
        point: 100,
      }),
    );

    await expect(provider.read()).resolves.toEqual({
      autoRechargeEnabled: null,
      balanceAmount: 2_500,
      lowBalanceAlertEnabled: null,
      pointAmount: 100,
    });
  });

  it("rejects an invalid provider response", async () => {
    const provider = new SolapiSdkAccountBalanceProvider(
      "a".repeat(24),
      "b".repeat(24),
      vi.fn().mockResolvedValue({ balance: -1, point: 0 }),
    );
    await expect(provider.read()).rejects.toThrow("SOLAPI_BALANCE_RESPONSE_INVALID");
  });
});
