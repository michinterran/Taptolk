export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [{ APP_IDENTITY, parseServerEnvironment }, { initializeServerObservability }] =
    await Promise.all([import("@taptolk/config"), import("@taptolk/observability/server")]);
  const environment = parseServerEnvironment();

  initializeServerObservability({
    ...(environment.SENTRY_DSN ? { dsn: environment.SENTRY_DSN } : {}),
    environment: environment.APP_ENV,
    service: APP_IDENTITY.serviceNames.web,
  });
}
