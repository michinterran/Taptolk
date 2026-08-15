import "server-only";

import {
  SolapiAccountHealthService,
  type SolapiAccountHealthSource,
  SolapiDeliveryReportService,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { createAdminServiceClient } from "../auth/service-client";
import { SolapiSdkAccountBalanceProvider } from "./solapi-account-balance-provider";
import {
  createSupabaseSolapiAccountHealthRepository,
  createSupabaseSolapiDeliveryReportRepository,
} from "./supabase-solapi-operations-repository";

function serviceDependencies() {
  const client = createAdminServiceClient();
  return client ? { client, environment: parseServerEnvironment() } : null;
}

export function readSolapiWebhookConfiguration(): { secret: string } | null {
  try {
    const secret = parseServerEnvironment().SOLAPI_WEBHOOK_SECRET;
    return secret ? { secret } : null;
  } catch {
    return null;
  }
}

export function createSolapiDeliveryReportService(): SolapiDeliveryReportService | null {
  const value = serviceDependencies();
  return value
    ? new SolapiDeliveryReportService(createSupabaseSolapiDeliveryReportRepository(value.client))
    : null;
}

export async function captureSolapiAccountHealth(
  source: SolapiAccountHealthSource,
): Promise<"CHECKED" | "UNAVAILABLE"> {
  const value = serviceDependencies();
  if (!value?.environment.SOLAPI_API_KEY || !value.environment.SOLAPI_API_SECRET) {
    return "UNAVAILABLE";
  }
  const service = new SolapiAccountHealthService(
    createSupabaseSolapiAccountHealthRepository(value.client),
    new SolapiSdkAccountBalanceProvider(
      value.environment.SOLAPI_API_KEY,
      value.environment.SOLAPI_API_SECRET,
    ),
  );
  const result = await service.capture({
    source,
    warningThresholdAmount: value.environment.SOLAPI_BALANCE_WARNING_KRW,
  });
  return result.status;
}
