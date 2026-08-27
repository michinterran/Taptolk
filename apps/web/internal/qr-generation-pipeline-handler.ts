import type { QrGenerationDispatchRuntimeResult } from "@taptolk/application";
import type { QrQueueWorkerRuntimeInitialization } from "@taptolk/worker";
import type { StagingQrGenerationDispatchRuntimeConfiguration } from "./qr-generation-dispatch-configuration";
import { parseQrGenerationPipelineWake } from "./qr-generation-pipeline-contract";

export class QrGenerationPipelineConfigurationError extends Error {
  constructor(readonly missingVariables: readonly string[] = []) {
    super("QR generation pipeline configuration is unavailable.");
    this.name = "QrGenerationPipelineConfigurationError";
  }
}

export class QrGenerationPipelineRetryError extends Error {
  constructor(readonly code: "NO_WORK_YET" | "WORKER_RETRY") {
    super(`QR generation pipeline requested retry: ${code}`);
    this.name = "QrGenerationPipelineRetryError";
  }
}

export interface QrGenerationPipelineHandlerDependencies {
  createWorkerRuntime(): Promise<QrQueueWorkerRuntimeInitialization>;
  readDispatchConfiguration(): StagingQrGenerationDispatchRuntimeConfiguration | null;
  runDispatch(
    configuration: StagingQrGenerationDispatchRuntimeConfiguration,
    requestId: string,
  ): Promise<QrGenerationDispatchRuntimeResult>;
}

export interface QrGenerationPipelineHandlerResult {
  dispatchClaimedCount: number;
  workerStatus: "COMPLETED" | "EMPTY" | "REJECTED";
}

export async function handleQrGenerationPipelineMessage(
  input: unknown,
  metadata: { deliveryCount: number },
  dependencies: QrGenerationPipelineHandlerDependencies,
): Promise<QrGenerationPipelineHandlerResult> {
  const wake = parseQrGenerationPipelineWake(input);
  const configuration = dependencies.readDispatchConfiguration();
  if (!configuration) {
    throw new QrGenerationPipelineConfigurationError();
  }

  const worker = await dependencies.createWorkerRuntime();
  if (!worker.ready) {
    throw new QrGenerationPipelineConfigurationError(worker.missingVariables);
  }

  const dispatch = await dependencies.runDispatch(configuration, wake.requestId);
  let sawCompleted = false;
  let sawRejected = false;
  let sawEmpty = false;
  const workerIterations = Math.max(dispatch.claimedCount, 1);
  for (let index = 0; index < workerIterations; index += 1) {
    const iteration = await worker.runOnce();
    if (iteration.status === "RETRY") {
      throw new QrGenerationPipelineRetryError("WORKER_RETRY");
    }
    sawCompleted ||= iteration.status === "COMPLETED";
    sawRejected ||= iteration.status === "REJECTED";
    sawEmpty ||= iteration.status === "EMPTY";
    if (iteration.status === "EMPTY") break;
  }
  const workerStatus = sawCompleted ? "COMPLETED" : sawRejected ? "REJECTED" : "EMPTY";
  if (dispatch.claimedCount === 0 && sawEmpty && metadata.deliveryCount < 5) {
    throw new QrGenerationPipelineRetryError("NO_WORK_YET");
  }

  return {
    dispatchClaimedCount: dispatch.claimedCount,
    workerStatus,
  };
}
