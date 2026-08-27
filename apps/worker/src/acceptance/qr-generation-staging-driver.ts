import { createHash } from "node:crypto";
import { createTaptolkAdminClient } from "@taptolk/auth";
import { parseClientEnvironment, parseServerEnvironment } from "@taptolk/config";
import {
  type QrGenerationExecutionRepository,
  QrGenerationHandler,
  QrPrintExportHandler,
  QrPrintExportHandlerError,
  readWorkerTaptolkLogoDataUri,
  SupabaseQrGenerationArtifactStore,
  SupabaseQrGenerationExecutionRepository,
  SupabaseQrPrintExportRuntime,
  SupabaseQrWorkerFailureRepository,
  sharpQrGenerationRenderer,
} from "../jobs/index.js";
import {
  type PgmqQueueEnvelope,
  type QrWorkerExecution,
  QrWorkerExecutionError,
  type QrWorkerExecutionErrorCode,
  runQrQueueIteration,
  type SupabasePgmqClient,
  SupabasePgmqQueue,
} from "../pgmq-queue-runtime.js";
import { resolveQrCredentialEncryption } from "../qr-credential-encryption.js";
import { queueJobSchema } from "../queue-consumer.js";

const ARTIFACT_BUCKET = "qr-artifacts";
const QUEUE_NAME = "qr-generation";
const VISIBILITY_LEASE_SECONDS = 60;

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readPoisonMessageId(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    (typeof candidate !== "string" && typeof candidate !== "number") ||
    !/^[1-9][0-9]*$/u.test(String(candidate))
  ) {
    throw new Error("ACCEPTANCE_POISON_MESSAGE_ID_INVALID");
  }
  return String(candidate);
}

function safePrintContextProbeCode(result: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}): string {
  if (result.error) {
    const knownMessages = new Set([
      "BATCH_NOT_EXPORTABLE",
      "BATCH_NOT_FOUND",
      "EXPORT_ITEM_COUNT_MISMATCH",
      "GENERATION_NOT_COMPLETED",
      "SERVICE_ROLE_REQUIRED",
    ]);
    if (result.error.message && knownMessages.has(result.error.message)) {
      return result.error.message;
    }
    return /^[A-Z0-9]{5}$/u.test(result.error.code ?? "") ? `PG_${result.error.code}` : "RPC_ERROR";
  }
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    return "NON_OBJECT";
  }
  const row = result.data as Record<string, unknown>;
  for (const [field, expectedType] of [
    ["tenant_id", "string"],
    ["site_id", "string"],
    ["batch_id", "string"],
    ["batch_code", "string"],
    ["export_revision", "number"],
    ["already_completed", "boolean"],
  ] as const) {
    if (typeof row[field] !== expectedType) {
      return `FIELD_${field.toUpperCase()}`;
    }
  }
  if (!Array.isArray(row.items)) {
    return "FIELD_ITEMS";
  }
  const invalidItem = row.items.find(
    (value) =>
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof (value as Record<string, unknown>).ordinal !== "number" ||
      typeof (value as Record<string, unknown>).human_code !== "string" ||
      typeof (value as Record<string, unknown>).preview_png_path !== "string" ||
      typeof (value as Record<string, unknown>).print_svg_path !== "string" ||
      typeof (value as Record<string, unknown>).render_checksum_sha256 !== "string",
  );
  return invalidItem ? "ITEM_SHAPE" : "UNKNOWN_MAPPING";
}

async function exactCount(
  client: ReturnType<typeof createTaptolkAdminClient>,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const result = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (result.error || result.count === null) {
    throw new Error("ACCEPTANCE_PARTIAL_COUNT_UNAVAILABLE");
  }
  return result.count;
}

async function main(): Promise<void> {
  const serverEnvironment = parseServerEnvironment();
  const clientEnvironment = parseClientEnvironment(process.env);
  const credentialEncryption = resolveQrCredentialEncryption(serverEnvironment);
  const acceptanceLabel = process.env.TAPTOLK_QR_ACCEPTANCE_LABEL;
  assertCondition(serverEnvironment.APP_ENV === "staging", "ACCEPTANCE_STAGING_REQUIRED");
  assertCondition(clientEnvironment.NEXT_PUBLIC_SUPABASE_URL, "ACCEPTANCE_SUPABASE_URL_REQUIRED");
  assertCondition(serverEnvironment.SUPABASE_SECRET_KEY, "ACCEPTANCE_SERVICE_KEY_REQUIRED");
  assertCondition(credentialEncryption, "ACCEPTANCE_ENCRYPTION_KEY_REQUIRED");
  assertCondition(
    acceptanceLabel && /^QR1K-[A-Z0-9]{8,24}$/u.test(acceptanceLabel),
    "ACCEPTANCE_LABEL_REQUIRED",
  );

  const client = createTaptolkAdminClient({
    secretKey: serverEnvironment.SUPABASE_SECRET_KEY,
    url: clientEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  });
  const queue = new SupabasePgmqQueue(
    client as unknown as SupabasePgmqClient,
    QUEUE_NAME,
    VISIBILITY_LEASE_SECONDS,
  );
  const generationRepository = new SupabaseQrGenerationExecutionRepository(client);
  const artifactStore = new SupabaseQrGenerationArtifactStore(client, ARTIFACT_BUCKET);
  const printRuntime = new SupabaseQrPrintExportRuntime(client, ARTIFACT_BUCKET);
  const generationOptions = {
    encryptionKey: createHash("sha256")
      .update(`qr-credential-encryption\0${credentialEncryption.secret}`, "utf8")
      .digest(),
    keyVersion: credentialEncryption.keyVersion,
    publicQrBaseUrl:
      serverEnvironment.PUBLIC_QR_BASE_URL ?? "https://staging-acceptance.taptolk.invalid",
    renderConcurrency: serverEnvironment.QR_GENERATION_RENDER_CONCURRENCY,
    taptolkLogoDataUri: await readWorkerTaptolkLogoDataUri(),
  };
  const failures = new SupabaseQrWorkerFailureRepository(client);
  const generationHandler = new QrGenerationHandler(
    generationRepository,
    artifactStore,
    sharpQrGenerationRenderer,
    generationOptions,
  );
  const printHandler = new QrPrintExportHandler(printRuntime, printRuntime, {
    loadConcurrency: serverEnvironment.QR_PRINT_EXPORT_LOAD_CONCURRENCY,
    storeConcurrency: serverEnvironment.QR_PRINT_EXPORT_STORE_CONCURRENCY,
  });
  let lastSafeFailure = "NONE";
  const normalExecution: QrWorkerExecution = {
    async execute(job) {
      try {
        await generationHandler.handle(job);
      } catch {
        lastSafeFailure = "GENERATION";
        throw new QrWorkerExecutionError("GENERATION_UNAVAILABLE");
      }
      try {
        await printHandler.handle(job.batchId);
      } catch (error) {
        if (error instanceof QrPrintExportHandlerError && error.code === "CONTEXT_LOAD") {
          const probe = await client.rpc("get_qr_print_export_context", {
            p_batch_id: job.batchId,
          });
          lastSafeFailure = `PRINT_CONTEXT_${safePrintContextProbeCode(probe)}`;
        } else {
          lastSafeFailure =
            error instanceof QrPrintExportHandlerError ? `PRINT_${error.code}` : "PRINT_UNKNOWN";
        }
        throw new QrWorkerExecutionError("PRINT_EXPORT_UNAVAILABLE");
      }
    },
    recordGenerationFailure(
      job,
      errorCode: QrWorkerExecutionErrorCode,
    ): Promise<{ terminal: boolean }> {
      assertCondition(
        errorCode !== "PRINT_EXPORT_UNAVAILABLE",
        "ACCEPTANCE_INVALID_GENERATION_FAILURE",
      );
      return failures.recordGenerationFailure({
        errorCode,
        generationRevision: job.generationRevision,
        jobId: job.jobId,
      });
    },
    recordPrintExportFailure(batchId) {
      return failures.recordPrintExportFailure(batchId);
    },
  };

  let interruptedAfterCommit = false;
  const interruptingRepository: QrGenerationExecutionRepository = {
    commitChunk: async (input) => {
      const result = await generationRepository.commitChunk(input);
      if (!interruptedAfterCommit && result.committedCount === 50) {
        interruptedAfterCommit = true;
        throw new Error("INTENTIONAL_POST_COMMIT_PROCESS_STOP");
      }
      return result;
    },
    complete: (input) => generationRepository.complete(input),
    start: (input) => generationRepository.start(input),
  };
  const interruptingGeneration = new QrGenerationHandler(
    interruptingRepository,
    artifactStore,
    sharpQrGenerationRenderer,
    generationOptions,
  );

  const firstEnvelope = await queue.read();
  assertCondition(firstEnvelope, "ACCEPTANCE_QUEUE_MESSAGE_REQUIRED");
  const interruptedJob = queueJobSchema.parse(firstEnvelope.message);
  let interruptionCode = "";
  let committedInterruptionLeaseStartedAt = 0;
  let interruptionEnvelope = firstEnvelope;
  for (
    let processAttempt = 1;
    processAttempt <= 3 && !interruptedAfterCommit;
    processAttempt += 1
  ) {
    const currentLeaseStartedAt = Date.now();
    try {
      await interruptingGeneration.handle(interruptedJob);
    } catch (error) {
      interruptionCode = error instanceof Error ? error.message : "UNEXPECTED_INTERRUPTION";
    }
    if (interruptedAfterCommit) {
      committedInterruptionLeaseStartedAt = currentLeaseStartedAt;
      break;
    }
    const retryWaitMs =
      currentLeaseStartedAt + VISIBILITY_LEASE_SECONDS * 1_000 - Date.now() + 1_500;
    if (retryWaitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryWaitMs));
    }
    const retriedEnvelope = await queue.read();
    assertCondition(
      retriedEnvelope?.messageId === firstEnvelope.messageId,
      "ACCEPTANCE_PRECOMMIT_RETRY_MESSAGE_MISMATCH",
    );
    interruptionEnvelope = retriedEnvelope;
  }
  assertCondition(interruptedAfterCommit, "ACCEPTANCE_CHUNK_INTERRUPT_NOT_REACHED");
  assertCondition(
    interruptionCode === "INTENTIONAL_POST_COMMIT_PROCESS_STOP",
    "ACCEPTANCE_INTERRUPTION_NOT_OBSERVED",
  );

  const partialCounts = await Promise.all([
    exactCount(client, "qr_generation_items", "generation_job_id", interruptedJob.jobId),
    exactCount(client, "qr_assets", "batch_id", interruptedJob.batchId),
    exactCount(client, "qr_activation_codes", "tenant_id", interruptedJob.tenantId),
    exactCount(client, "rendered_assets", "tenant_id", interruptedJob.tenantId),
  ]);
  assertCondition(
    partialCounts.every((count) => count === 50),
    "ACCEPTANCE_PARTIAL_COMMIT_NOT_EXACT",
  );

  const leaseWaitMs =
    committedInterruptionLeaseStartedAt + VISIBILITY_LEASE_SECONDS * 1_000 - Date.now() + 1_500;
  if (leaseWaitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, leaseWaitMs));
  }

  const observedEnvelopes: PgmqQueueEnvelope[] = [];
  const observingQueue = {
    archive: (messageId: string) => queue.archive(messageId),
    read: async () => {
      const envelope = await queue.read();
      if (envelope) {
        observedEnvelopes.push(envelope);
      }
      return envelope;
    },
  };
  const completedMessageIds = new Set<string>();
  let iterationRetryCount = 0;
  const processingDeadline = Date.now() + 60 * 60_000;
  while (completedMessageIds.size < 10 && Date.now() < processingDeadline) {
    const result = await runQrQueueIteration(observingQueue, normalExecution, 5);
    assertCondition(result.status !== "REJECTED", `ACCEPTANCE_JOB_REJECTED_${lastSafeFailure}`);
    if (result.status === "COMPLETED") {
      completedMessageIds.add(result.messageId);
    } else if (result.status === "RETRY") {
      iterationRetryCount += 1;
    } else if (result.status === "EMPTY") {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  assertCondition(completedMessageIds.size === 10, "ACCEPTANCE_JOB_COUNT_INCOMPLETE");
  const resumedEnvelope = observedEnvelopes.find((envelope) => {
    const parsed = queueJobSchema.safeParse(envelope.message);
    return parsed.success && parsed.data.jobId === interruptedJob.jobId;
  });
  assertCondition(
    resumedEnvelope?.messageId === firstEnvelope.messageId &&
      resumedEnvelope.readCount > interruptionEnvelope.readCount,
    "ACCEPTANCE_LEASE_RESUME_NOT_OBSERVED",
  );

  const poisonPublication = await client.schema("pgmq_public").rpc("send", {
    message: {
      acceptanceTag: acceptanceLabel,
      jobType: "POISON",
      schemaVersion: 999,
    },
    queue_name: QUEUE_NAME,
    sleep_seconds: 0,
  });
  if (poisonPublication.error) {
    throw new Error("ACCEPTANCE_POISON_PUBLISH_UNAVAILABLE");
  }
  const poisonMessageId = readPoisonMessageId(poisonPublication.data);
  const poisonResult = await runQrQueueIteration(queue, normalExecution, 5);
  assertCondition(
    poisonResult.status === "REJECTED" && poisonResult.messageId === poisonMessageId,
    "ACCEPTANCE_POISON_ARCHIVE_NOT_OBSERVED",
  );

  process.stdout.write(
    `${JSON.stringify({
      completedMessages: completedMessageIds.size,
      interruptedChunkItems: 50,
      iterationRetryCount,
      poisonArchived: 1,
      resumedReadCount: resumedEnvelope.readCount,
    })}\n`,
  );
}

await main();
