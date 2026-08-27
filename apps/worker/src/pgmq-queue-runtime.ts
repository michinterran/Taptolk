import { type QueueJob, queueJobSchema } from "./queue-consumer.js";

export interface PgmqQueueEnvelope {
  message: unknown;
  messageId: string;
  readCount: number;
}

export interface PgmqQueue {
  archive(messageId: string): Promise<void>;
  read(): Promise<PgmqQueueEnvelope | null>;
}

export interface QrWorkerExecution {
  execute(job: QueueJob): Promise<void>;
  recordGenerationFailure(
    job: QueueJob,
    errorCode: QrWorkerExecutionErrorCode,
  ): Promise<{ terminal: boolean }>;
  recordPrintExportFailure(batchId: string): Promise<void>;
}

export type QrWorkerExecutionErrorCode =
  | "ARTIFACT_STORAGE_UNAVAILABLE"
  | "GENERATION_CONTEXT_INVALID"
  | "GENERATION_UNAVAILABLE"
  | "PRINT_EXPORT_UNAVAILABLE";

export class QrWorkerExecutionError extends Error {
  constructor(readonly code: QrWorkerExecutionErrorCode) {
    super(`QR worker execution failed: ${code}`);
    this.name = "QrWorkerExecutionError";
  }
}

export type QrQueueIterationResult =
  | { status: "COMPLETED"; messageId: string }
  | { status: "EMPTY" }
  | { status: "REJECTED"; messageId: string }
  | { status: "RETRY"; messageId: string };

export async function runQrQueueIteration(
  queue: PgmqQueue,
  execution: QrWorkerExecution,
  maxReadCount: number,
): Promise<QrQueueIterationResult> {
  if (!Number.isInteger(maxReadCount) || maxReadCount < 1 || maxReadCount > 20) {
    throw new Error("INVALID_QUEUE_MAX_READ_COUNT");
  }
  const envelope = await queue.read();
  if (!envelope) {
    return { status: "EMPTY" };
  }
  const parsed = queueJobSchema.safeParse(envelope.message);
  if (!parsed.success) {
    await queue.archive(envelope.messageId);
    return { messageId: envelope.messageId, status: "REJECTED" };
  }

  try {
    await execution.execute(parsed.data);
    await queue.archive(envelope.messageId);
    return { messageId: envelope.messageId, status: "COMPLETED" };
  } catch (error) {
    const code = error instanceof QrWorkerExecutionError ? error.code : "GENERATION_UNAVAILABLE";
    if (code === "PRINT_EXPORT_UNAVAILABLE") {
      if (envelope.readCount >= maxReadCount) {
        await execution.recordPrintExportFailure(parsed.data.batchId);
        await queue.archive(envelope.messageId);
        return { messageId: envelope.messageId, status: "REJECTED" };
      }
      return { messageId: envelope.messageId, status: "RETRY" };
    }
    const failure = await execution.recordGenerationFailure(parsed.data, code);
    if (failure.terminal) {
      await queue.archive(envelope.messageId);
      return { messageId: envelope.messageId, status: "REJECTED" };
    }
    return { messageId: envelope.messageId, status: "RETRY" };
  }
}

interface SupabaseQueueResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

export interface SupabasePgmqClient {
  schema(schemaName: "pgmq_public"): {
    rpc(
      functionName: "archive" | "read",
      parameters: Readonly<Record<string, unknown>>,
    ): PromiseLike<SupabaseQueueResult>;
  };
}

function parseEnvelope(value: unknown): PgmqQueueEnvelope | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (row === undefined || row === null) {
    return null;
  }
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("QUEUE_READ_INVALID");
  }
  const candidate = row as Record<string, unknown>;
  const messageId = candidate.msg_id;
  if (
    (typeof messageId !== "string" && typeof messageId !== "number") ||
    typeof candidate.read_ct !== "number" ||
    !Number.isInteger(candidate.read_ct) ||
    candidate.read_ct < 1
  ) {
    throw new Error("QUEUE_READ_INVALID");
  }
  return {
    message: candidate.message,
    messageId: String(messageId),
    readCount: candidate.read_ct,
  };
}

export class SupabasePgmqQueue implements PgmqQueue {
  constructor(
    private readonly client: SupabasePgmqClient,
    private readonly queueName: string,
    visibilityTimeoutSeconds: number,
    private readonly pollSeconds = visibilityTimeoutSeconds,
  ) {}

  async read(): Promise<PgmqQueueEnvelope | null> {
    const result = await this.client.schema("pgmq_public").rpc("read", {
      n: 1,
      queue_name: this.queueName,
      sleep_seconds: this.pollSeconds,
    });
    if (result.error) {
      throw new Error("QUEUE_READ_UNAVAILABLE");
    }
    return parseEnvelope(result.data);
  }

  async archive(messageId: string): Promise<void> {
    const result = await this.client.schema("pgmq_public").rpc("archive", {
      message_id: messageId,
      queue_name: this.queueName,
    });
    const archived = Array.isArray(result.data) ? result.data[0] : result.data;
    if (result.error || archived !== true) {
      throw new Error("QUEUE_ARCHIVE_UNAVAILABLE");
    }
  }
}
