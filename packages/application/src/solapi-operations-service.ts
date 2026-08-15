export type SolapiDeliveryOutcome = "DELIVERED" | "FAILED" | "PENDING";

export interface SolapiDeliveryReport {
  idempotencyKey: string | null;
  providerMessageId: string;
  providerReceivedAt: string | null;
  providerReportedAt: string;
  statusCode: string;
}

export interface SolapiDeliveryReportRecord {
  matched: boolean;
  outcome: SolapiDeliveryOutcome;
}

export interface SolapiDeliveryReportRepository {
  recordBatch(
    reports: readonly SolapiDeliveryReport[],
  ): Promise<readonly SolapiDeliveryReportRecord[]>;
}

export interface SolapiDeliveryReportBatchResult {
  delivered: number;
  failed: number;
  matched: number;
  pending: number;
  received: number;
  unmatched: number;
}

export class SolapiDeliveryReportService {
  constructor(private readonly repository: SolapiDeliveryReportRepository) {}

  async recordBatch(
    reports: readonly SolapiDeliveryReport[],
  ): Promise<SolapiDeliveryReportBatchResult> {
    const result: SolapiDeliveryReportBatchResult = {
      delivered: 0,
      failed: 0,
      matched: 0,
      pending: 0,
      received: reports.length,
      unmatched: 0,
    };

    const records = await this.repository.recordBatch(reports);
    if (records.length !== reports.length) {
      throw new Error("SOLAPI_DELIVERY_REPORT_COUNT_MISMATCH");
    }
    for (const recorded of records) {
      if (recorded.matched) {
        result.matched += 1;
      } else {
        result.unmatched += 1;
      }
      if (recorded.outcome === "DELIVERED") result.delivered += 1;
      if (recorded.outcome === "FAILED") result.failed += 1;
      if (recorded.outcome === "PENDING") result.pending += 1;
    }

    return result;
  }
}

export type SolapiAccountHealthSource = "CRON" | "DISPATCH" | "MANUAL" | "WEBHOOK";

export interface SolapiAccountBalance {
  autoRechargeEnabled: boolean | null;
  balanceAmount: number;
  lowBalanceAlertEnabled: boolean | null;
  pointAmount: number;
}

export interface SolapiAccountBalanceProvider {
  read(): Promise<SolapiAccountBalance>;
}

export interface SolapiAccountHealthRepository {
  recordChecked(
    input: SolapiAccountBalance & {
      source: SolapiAccountHealthSource;
      warningThresholdAmount: number;
    },
  ): Promise<void>;
  recordUnavailable(input: {
    errorCode: "PROVIDER_UNAVAILABLE";
    source: SolapiAccountHealthSource;
    warningThresholdAmount: number;
  }): Promise<void>;
}

export type SolapiAccountHealthResult =
  | (SolapiAccountBalance & { status: "CHECKED" })
  | { status: "UNAVAILABLE" };

export class SolapiAccountHealthService {
  constructor(
    private readonly repository: SolapiAccountHealthRepository,
    private readonly provider: SolapiAccountBalanceProvider,
  ) {}

  async capture(input: {
    source: SolapiAccountHealthSource;
    warningThresholdAmount: number;
  }): Promise<SolapiAccountHealthResult> {
    if (!Number.isFinite(input.warningThresholdAmount) || input.warningThresholdAmount < 0) {
      throw new Error("INVALID_SOLAPI_BALANCE_THRESHOLD");
    }
    let balance: SolapiAccountBalance;
    try {
      balance = await this.provider.read();
    } catch {
      await this.repository.recordUnavailable({
        errorCode: "PROVIDER_UNAVAILABLE",
        source: input.source,
        warningThresholdAmount: input.warningThresholdAmount,
      });
      return { status: "UNAVAILABLE" };
    }

    await this.repository.recordChecked({
      ...balance,
      source: input.source,
      warningThresholdAmount: input.warningThresholdAmount,
    });
    return { ...balance, status: "CHECKED" };
  }
}
