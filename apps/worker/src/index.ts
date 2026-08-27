import { APP_IDENTITY, parseServerEnvironment } from "@taptolk/config";
import { createLogger, initializeServerObservability } from "@taptolk/observability";
import { createWorkerHealth } from "./health.js";
import { createQrQueueWorkerRuntime } from "./runtime.js";

const environment = parseServerEnvironment();
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
  const runtime = await createQrQueueWorkerRuntime();
  if (!runtime.ready) {
    logger.warn("worker.qr_queue.configuration_unavailable", {
      errorCode: "CONFIGURATION_UNAVAILABLE",
      missingVariables: runtime.missingVariables,
    });
    return;
  }

  const tick = async () => {
    if (stopping) {
      return;
    }
    try {
      const result = await runtime.runOnce();
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
