import { createHash } from "node:crypto";
import { createTaptolkAdminClient } from "@taptolk/auth";
import { APP_IDENTITY, parseClientEnvironment, parseServerEnvironment } from "@taptolk/config";
import { createLogger, initializeServerObservability } from "@taptolk/observability";
import { createWorkerHealth } from "./health.js";
import {
  QrGenerationHandler,
  QrPrintExportHandler,
  QrWorkerExecutionRuntime,
  readWorkerTaptolkLogoDataUri,
  SupabaseQrGenerationArtifactStore,
  SupabaseQrGenerationExecutionRepository,
  SupabaseQrPrintExportRuntime,
  SupabaseQrWorkerFailureRepository,
  sharpQrGenerationRenderer,
} from "./jobs/index.js";
import {
  runQrQueueIteration,
  type SupabasePgmqClient,
  SupabasePgmqQueue,
} from "./pgmq-queue-runtime.js";

const environment = parseServerEnvironment();
const clientEnvironment = parseClientEnvironment(process.env);
const logger = createLogger({ service: APP_IDENTITY.serviceNames.worker });

initializeServerObservability({
  ...(environment.SENTRY_DSN ? { dsn: environment.SENTRY_DSN } : {}),
  environment: environment.APP_ENV,
  service: APP_IDENTITY.serviceNames.worker,
});

logger.info("worker.ready", { ...createWorkerHealth(APP_IDENTITY.serviceNames.worker) });

let queueTimer: NodeJS.Timeout | null = null;
let stopping = false;

async function initializeQrQueueWorker(): Promise<void> {
  if (
    !clientEnvironment.NEXT_PUBLIC_SUPABASE_URL ||
    !environment.SUPABASE_SECRET_KEY ||
    !environment.APP_ENCRYPTION_KEY_V1 ||
    !environment.PUBLIC_QR_BASE_URL
  ) {
    logger.warn("worker.qr_queue.configuration_unavailable", {
      errorCode: "CONFIGURATION_UNAVAILABLE",
    });
    return;
  }
  const client = createTaptolkAdminClient({
    secretKey: environment.SUPABASE_SECRET_KEY,
    url: clientEnvironment.NEXT_PUBLIC_SUPABASE_URL,
  });
  const generationRepository = new SupabaseQrGenerationExecutionRepository(client);
  const artifactStore = new SupabaseQrGenerationArtifactStore(client);
  const generation = new QrGenerationHandler(
    generationRepository,
    artifactStore,
    sharpQrGenerationRenderer,
    {
      encryptionKey: createHash("sha256")
        .update(`qr-credential-encryption\0${environment.APP_ENCRYPTION_KEY_V1}`, "utf8")
        .digest(),
      keyVersion: environment.APP_ENCRYPTION_KEY_VERSION,
      publicQrBaseUrl: environment.PUBLIC_QR_BASE_URL,
      taptolkLogoDataUri: await readWorkerTaptolkLogoDataUri(),
    },
  );
  const printRuntime = new SupabaseQrPrintExportRuntime(client);
  const execution = new QrWorkerExecutionRuntime(
    generation,
    new QrPrintExportHandler(printRuntime, printRuntime),
    new SupabaseQrWorkerFailureRepository(client),
  );
  const queue = new SupabasePgmqQueue(
    client as unknown as SupabasePgmqClient,
    environment.QR_GENERATION_QUEUE_NAME,
    environment.QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  );

  const tick = async () => {
    if (stopping) {
      return;
    }
    try {
      const result = await runQrQueueIteration(
        queue,
        execution,
        environment.QR_GENERATION_QUEUE_MAX_READ_COUNT,
      );
      if (result.status !== "EMPTY") {
        logger.info("worker.qr_queue.iteration_completed", {
          resultStatus: result.status,
        });
      }
    } catch {
      logger.error("worker.qr_queue.iteration_failed", {
        errorCode: "QUEUE_ITERATION_UNAVAILABLE",
      });
    } finally {
      if (!stopping) {
        queueTimer = setTimeout(tick, environment.QR_GENERATION_QUEUE_POLL_INTERVAL_MS);
      }
    }
  };
  queueTimer = setTimeout(tick, 0);
  logger.info("worker.qr_queue.ready");
}

await initializeQrQueueWorker();

const keepAlive = setInterval(() => {
  logger.info("worker.heartbeat");
}, 30_000);

function shutdown(signal: NodeJS.Signals) {
  stopping = true;
  if (queueTimer) {
    clearTimeout(queueTimer);
  }
  clearInterval(keepAlive);
  logger.info("worker.stopped", { signal });
  process.exitCode = 0;
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
