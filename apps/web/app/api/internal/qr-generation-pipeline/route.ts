import { readFile } from "node:fs/promises";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import {
  createQrQueueWorkerRuntime,
  QR_GENERATION_VERCEL_FUNCTION_VISIBILITY_TIMEOUT_SECONDS,
} from "@taptolk/worker";
import { handleCallback } from "@vercel/queue";
import {
  readStagingQrGenerationDispatchRuntimeConfiguration,
  runStagingQrGenerationDispatch,
} from "../../../../internal/qr-generation-dispatch-runtime";
import {
  handleQrGenerationPipelineMessage,
  QrGenerationPipelineRetryError,
} from "../../../../internal/qr-generation-pipeline-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

const logoDataUri = readFile(
  new URL("../../../../public/brand/taptolk-logo.png", import.meta.url),
).then((logo) => `data:image/png;base64,${logo.toString("base64")}`);

export const POST = handleCallback(
  async (message, metadata) => {
    const requestId = crypto.randomUUID();
    const result = await handleQrGenerationPipelineMessage(message, metadata, {
      async createWorkerRuntime() {
        return createQrQueueWorkerRuntime(process.env, {
          taptolkLogoDataUri: await logoDataUri,
          visibilityTimeoutSeconds: QR_GENERATION_VERCEL_FUNCTION_VISIBILITY_TIMEOUT_SECONDS,
        });
      },
      readDispatchConfiguration: readStagingQrGenerationDispatchRuntimeConfiguration,
      runDispatch: runStagingQrGenerationDispatch,
    });

    createLogger({
      requestId,
      service: APP_IDENTITY.serviceNames.web,
    }).info("qr_generation.pipeline.completed", {
      dispatchClaimedCount: result.dispatchClaimedCount,
      workerStatus: result.workerStatus,
    });
  },
  {
    retry(error, metadata) {
      if (
        error instanceof QrGenerationPipelineRetryError &&
        error.code === "NO_WORK_YET" &&
        metadata.deliveryCount >= 5
      ) {
        return { acknowledge: true };
      }
      return {
        afterSeconds: Math.min(300, 5 * 2 ** Math.min(metadata.deliveryCount, 6)),
      };
    },
    visibilityTimeoutSeconds: QR_GENERATION_VERCEL_FUNCTION_VISIBILITY_TIMEOUT_SECONDS,
  },
);
