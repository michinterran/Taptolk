import {
  type QrGenerationQueueMessage,
  type QrGenerationQueuePublisher,
  QrGenerationQueuePublisherError,
} from "@taptolk/application";

export const SUPABASE_QUEUE_SEND_TIMEOUT_MS_MIN = 250;
export const SUPABASE_QUEUE_SEND_TIMEOUT_MS_MAX = 10_000;

interface SupabaseQueueRpcError {
  code?: string;
  message?: string;
}

interface SupabaseQueueRpcResult {
  data: unknown;
  error: SupabaseQueueRpcError | null;
}

export interface SupabaseQueueRpcBuilder {
  abortSignal(signal: AbortSignal): PromiseLike<SupabaseQueueRpcResult>;
}

export interface SupabaseQueueSchemaClient {
  rpc(
    functionName: "send",
    parameters: {
      message: QrGenerationQueueMessage;
      queue_name: string;
      sleep_seconds: 0;
    },
  ): SupabaseQueueRpcBuilder;
}

export interface SupabaseQueueClient {
  schema(schemaName: "pgmq_public"): SupabaseQueueSchemaClient;
}

export interface SupabaseQrGenerationQueuePublisherConfig {
  queueName: string;
  requestTimeoutMs: number;
}

export class SupabaseQrGenerationQueuePublisherConfigurationError extends Error {
  readonly code: "INVALID_QUEUE_NAME" | "INVALID_REQUEST_TIMEOUT";

  constructor(code: SupabaseQrGenerationQueuePublisherConfigurationError["code"]) {
    super(`Supabase QR generation Queue publisher configuration rejected: ${code}`);
    this.name = "SupabaseQrGenerationQueuePublisherConfigurationError";
    this.code = code;
  }
}

const QUEUE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62})$/u;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/u;

function assertConfig(config: SupabaseQrGenerationQueuePublisherConfig): void {
  if (!QUEUE_NAME_PATTERN.test(config.queueName)) {
    throw new SupabaseQrGenerationQueuePublisherConfigurationError("INVALID_QUEUE_NAME");
  }
  if (
    !Number.isInteger(config.requestTimeoutMs) ||
    config.requestTimeoutMs < SUPABASE_QUEUE_SEND_TIMEOUT_MS_MIN ||
    config.requestTimeoutMs > SUPABASE_QUEUE_SEND_TIMEOUT_MS_MAX
  ) {
    throw new SupabaseQrGenerationQueuePublisherConfigurationError("INVALID_REQUEST_TIMEOUT");
  }
}

function isRateLimited(error: SupabaseQueueRpcError): boolean {
  const code = error.code?.trim().toUpperCase();
  const message = error.message?.toLowerCase() ?? "";
  return (
    code === "429" ||
    code === "TOO_MANY_REQUESTS" ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

function parseQueueMessageId(data: unknown): string {
  const value = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && POSITIVE_DECIMAL_PATTERN.test(value)) {
    return value;
  }
  throw new QrGenerationQueuePublisherError("QUEUE_UNAVAILABLE");
}

export function createSupabaseQrGenerationQueuePublisher(
  client: SupabaseQueueClient,
  config: SupabaseQrGenerationQueuePublisherConfig,
): QrGenerationQueuePublisher {
  assertConfig(config);

  return {
    async publish(message) {
      let result: SupabaseQueueRpcResult;
      try {
        result = await client
          .schema("pgmq_public")
          .rpc("send", {
            message,
            queue_name: config.queueName,
            sleep_seconds: 0,
          })
          .abortSignal(AbortSignal.timeout(config.requestTimeoutMs));
      } catch {
        throw new QrGenerationQueuePublisherError("QUEUE_UNAVAILABLE");
      }

      if (result.error) {
        throw new QrGenerationQueuePublisherError(
          isRateLimited(result.error) ? "QUEUE_RATE_LIMITED" : "QUEUE_UNAVAILABLE",
        );
      }

      return {
        queueMessageId: parseQueueMessageId(result.data),
      };
    },
  };
}
