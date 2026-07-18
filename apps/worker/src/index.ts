import { APP_IDENTITY, parseServerEnvironment } from "@taptolk/config";
import { createLogger, initializeServerObservability } from "@taptolk/observability";
import { createWorkerHealth } from "./health.js";

const environment = parseServerEnvironment();
const logger = createLogger({ service: APP_IDENTITY.serviceNames.worker });

initializeServerObservability({
  ...(environment.SENTRY_DSN ? { dsn: environment.SENTRY_DSN } : {}),
  environment: environment.APP_ENV,
  service: APP_IDENTITY.serviceNames.worker,
});

logger.info("worker.ready", { ...createWorkerHealth(APP_IDENTITY.serviceNames.worker) });

const keepAlive = setInterval(() => {
  logger.info("worker.heartbeat");
}, 30_000);

function shutdown(signal: NodeJS.Signals) {
  clearInterval(keepAlive);
  logger.info("worker.stopped", { signal });
  process.exitCode = 0;
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
