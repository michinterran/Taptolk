import type { QueueJobRegistry } from "../queue-consumer.js";

/**
 * Job handlers are registered with their owning feature. Phase 0 keeps this
 * registry empty rather than inventing SMS, rendering, or cleanup behavior.
 */
export const JOB_REGISTRY: QueueJobRegistry = Object.freeze({});
export {
  QR_GENERATION_EXECUTION_CHUNK_SIZE,
  type QrGenerationArtifact,
  type QrGenerationArtifactStore,
  type QrGenerationCommitItem,
  type QrGenerationExecutionContext,
  type QrGenerationExecutionRepository,
  QrGenerationHandler,
  type QrGenerationHandlerOptions,
  type QrGenerationRenderer,
  sharpQrGenerationRenderer,
} from "./qr-generation-handler.js";
export {
  type QrPrintExportArtifactStorage,
  type QrPrintExportContext,
  type QrPrintExportContextItem,
  QrPrintExportHandler,
  QrPrintExportHandlerError,
  type QrPrintExportHandlerErrorCode,
  type QrPrintExportHandlerOptions,
  type QrPrintExportRepository,
} from "./qr-print-export-handler.js";
export {
  QrWorkerExecutionRuntime,
  type QrWorkerFailureRepository,
} from "./qr-worker-execution.js";
export {
  readWorkerTaptolkLogoDataUri,
  SupabaseQrGenerationArtifactStore,
  SupabaseQrGenerationExecutionRepository,
  SupabaseQrGenerationRuntimeError,
  SupabaseQrPrintExportRuntime,
  SupabaseQrWorkerFailureRepository,
} from "./supabase-qr-generation-runtime.js";
