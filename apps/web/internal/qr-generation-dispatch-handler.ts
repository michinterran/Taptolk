import type { QrGenerationDispatchRuntimeResult } from "@taptolk/application";
import { isAuthorizedCronRequest } from "./cron-authorization";
import type { StagingQrGenerationDispatchConfiguration } from "./qr-generation-dispatch-configuration";

export interface QrGenerationDispatchHandlerDependencies {
  readConfiguration(): StagingQrGenerationDispatchConfiguration | null;
  run(
    configuration: StagingQrGenerationDispatchConfiguration,
    requestId: string,
  ): Promise<QrGenerationDispatchRuntimeResult>;
}

export interface QrGenerationDispatchHandlerResult {
  body: Readonly<Record<string, unknown>>;
  status: 200 | 401 | 500 | 503;
}

function errorResult(
  requestId: string,
  status: 401 | 500 | 503,
  code: "DISPATCH_FAILED" | "UNAUTHORIZED" | "UNAVAILABLE",
  retryable: boolean,
): QrGenerationDispatchHandlerResult {
  return {
    body: {
      error: {
        code,
        retryable,
      },
      meta: { requestId },
    },
    status,
  };
}

export async function handleQrGenerationDispatchRequest(
  input: {
    authorizationHeader: string | null;
    requestId: string;
  },
  dependencies: QrGenerationDispatchHandlerDependencies,
): Promise<QrGenerationDispatchHandlerResult> {
  const configuration = dependencies.readConfiguration();
  if (!configuration) {
    return errorResult(input.requestId, 503, "UNAVAILABLE", false);
  }

  if (!isAuthorizedCronRequest(input.authorizationHeader, configuration.cronSecret)) {
    return errorResult(input.requestId, 401, "UNAUTHORIZED", false);
  }

  try {
    const result = await dependencies.run(configuration, input.requestId);
    return {
      body: {
        data: result,
        meta: { requestId: input.requestId },
      },
      status: 200,
    };
  } catch {
    return errorResult(input.requestId, 500, "DISPATCH_FAILED", true);
  }
}
