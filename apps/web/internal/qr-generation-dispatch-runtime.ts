import "server-only";

import {
  BoundedQrGenerationDispatchRuntime,
  ExponentialQrGenerationDeliveryRetryPolicy,
  QrGenerationDispatchCoordinator,
  QrGenerationDispatcherService,
  type QrGenerationDispatchRuntimeResult,
} from "@taptolk/application";
import { APP_IDENTITY, parseServerEnvironment } from "@taptolk/config";
import {
  createQrGenerationDispatcherRpcRepository,
  createSupabaseQrGenerationQueuePublisher,
  type QrGenerationDispatcherRpcClient,
  type SupabaseQueueClient,
} from "@taptolk/db";
import { createLogger } from "@taptolk/observability";
import { readSecretSupabaseConfiguration } from "../auth/configuration";
import { createAdminServiceClient } from "../auth/service-client";
import {
  buildStagingQrGenerationDispatchConfiguration,
  type StagingQrGenerationDispatchConfiguration,
} from "./qr-generation-dispatch-configuration";

export class StagingQrGenerationDispatchUnavailableError extends Error {
  readonly code: "CLIENT_UNAVAILABLE";

  constructor() {
    super("Staging QR generation dispatch runtime is unavailable.");
    this.name = "StagingQrGenerationDispatchUnavailableError";
    this.code = "CLIENT_UNAVAILABLE";
  }
}

export function readStagingQrGenerationDispatchConfiguration(): StagingQrGenerationDispatchConfiguration | null {
  try {
    const environment = parseServerEnvironment();
    if (!readSecretSupabaseConfiguration()) {
      return null;
    }
    return buildStagingQrGenerationDispatchConfiguration(environment);
  } catch {
    return null;
  }
}

export async function runStagingQrGenerationDispatch(
  configuration: StagingQrGenerationDispatchConfiguration,
  requestId: string,
): Promise<QrGenerationDispatchRuntimeResult> {
  const client = createAdminServiceClient();
  if (!client) {
    throw new StagingQrGenerationDispatchUnavailableError();
  }

  const rpcClient: QrGenerationDispatcherRpcClient = {
    async rpc(functionName, parameters) {
      const result = await client.rpc(functionName, parameters);
      return {
        data: result.data,
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
            }
          : null,
      };
    },
  };
  const commands = new QrGenerationDispatcherService(
    createQrGenerationDispatcherRpcRepository(rpcClient),
  );
  const publisher = createSupabaseQrGenerationQueuePublisher(
    client as unknown as SupabaseQueueClient,
    configuration.publisher,
  );
  const retryPolicy = new ExponentialQrGenerationDeliveryRetryPolicy(configuration.retry);
  const coordinator = new QrGenerationDispatchCoordinator(commands, publisher, retryPolicy);
  const runtime = new BoundedQrGenerationDispatchRuntime(coordinator, configuration.runtime);
  const result = await runtime.run();

  createLogger({
    requestId,
    service: APP_IDENTITY.serviceNames.web,
  }).info("qr_generation.dispatch.completed", {
    claimedCount: result.claimedCount,
    completedWithinBudget: result.completedWithinBudget,
    outcomeCounts: result.outcomeCounts,
  });

  return result;
}
