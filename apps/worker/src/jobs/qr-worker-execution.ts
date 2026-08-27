import {
  type QrWorkerExecution,
  QrWorkerExecutionError,
  type QrWorkerExecutionErrorCode,
} from "../pgmq-queue-runtime.js";
import type { QueueJob } from "../queue-consumer.js";
import type { QrGenerationHandler } from "./qr-generation-handler.js";
import type { QrPrintExportHandler } from "./qr-print-export-handler.js";

export interface QrWorkerFailureRepository {
  recordGenerationFailure(input: {
    errorCode: Exclude<QrWorkerExecutionErrorCode, "PRINT_EXPORT_UNAVAILABLE">;
    generationRevision: number;
    jobId: string;
  }): Promise<{ terminal: boolean }>;
  recordPrintExportFailure(batchId: string): Promise<void>;
}

export class QrWorkerExecutionRuntime implements QrWorkerExecution {
  constructor(
    private readonly generation: QrGenerationHandler,
    private readonly printExport: QrPrintExportHandler,
    private readonly failures: QrWorkerFailureRepository,
  ) {}

  async execute(job: QueueJob): Promise<void> {
    try {
      await this.generation.handle(job);
    } catch {
      throw new QrWorkerExecutionError("GENERATION_UNAVAILABLE");
    }
    try {
      await this.printExport.handle(job.batchId);
    } catch {
      throw new QrWorkerExecutionError("PRINT_EXPORT_UNAVAILABLE");
    }
  }

  async recordGenerationFailure(
    job: QueueJob,
    errorCode: QrWorkerExecutionErrorCode,
  ): Promise<{ terminal: boolean }> {
    if (errorCode === "PRINT_EXPORT_UNAVAILABLE") {
      throw new Error("INVALID_GENERATION_FAILURE_CODE");
    }
    return this.failures.recordGenerationFailure({
      errorCode,
      generationRevision: job.generationRevision,
      jobId: job.jobId,
    });
  }

  async recordPrintExportFailure(batchId: string): Promise<void> {
    await this.failures.recordPrintExportFailure(batchId);
  }
}
