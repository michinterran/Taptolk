import "server-only";

import type { SolapiAccountBalanceProvider } from "@taptolk/application";
import { SolapiMessageService } from "solapi";

export class SolapiSdkAccountBalanceProvider implements SolapiAccountBalanceProvider {
  private readonly getBalance: SolapiMessageService["getBalance"];

  constructor(apiKey: string, apiSecret: string, getBalance?: SolapiMessageService["getBalance"]) {
    const service = new SolapiMessageService(apiKey, apiSecret);
    this.getBalance = getBalance ?? service.getBalance.bind(service);
  }

  async read() {
    const result = await this.getBalance();
    if (
      !Number.isFinite(result.balance) ||
      result.balance < 0 ||
      !Number.isFinite(result.point) ||
      result.point < 0
    ) {
      throw new Error("SOLAPI_BALANCE_RESPONSE_INVALID");
    }
    return {
      autoRechargeEnabled: null,
      balanceAmount: result.balance,
      lowBalanceAlertEnabled: null,
      pointAmount: result.point,
    };
  }
}
