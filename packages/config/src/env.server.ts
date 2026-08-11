import { z } from "zod";
import {
  appEnvironmentSchema,
  emptyStringToUndefined,
  integerEnvironmentSchema,
  numberEnvironmentSchema,
  optionalApiKeySchema,
  optionalSecretSchema,
  optionalUrlSchema,
} from "./env.shared.js";

const serverEnvironmentSchema = z
  .object({
    APP_ENCRYPTION_KEY_V1: optionalSecretSchema,
    APP_ENCRYPTION_KEY_VERSION: integerEnvironmentSchema(1, 1, 100),
    APP_ENV: appEnvironmentSchema.default("local"),
    APP_TIMEZONE: z.string().min(1).default("Asia/Seoul"),
    APP_URL: optionalUrlSchema,
    BLOCK_REVOCATION_GRACE_HOURS: integerEnvironmentSchema(0, 0, 168),
    CONTACT_SESSION_TTL_MINUTES: integerEnvironmentSchema(60),
    COOKIE_SIGNING_KEY: optionalSecretSchema,
    CRON_SECRET: optionalSecretSchema,
    DATABASE_URL: optionalUrlSchema,
    DEVICE_TOTAL_LIMIT_PER_10_MINUTES: integerEnvironmentSchema(5),
    DIRECT_DATABASE_URL: optionalUrlSchema,
    FREE_MESSAGE_MAX_LENGTH: integerEnvironmentSchema(200),
    IP_QR_LIMIT_PER_10_MINUTES: integerEnvironmentSchema(3),
    MESSAGE_RETENTION_HOURS: integerEnvironmentSchema(72),
    OWNER_RESPONSE_BASE_URL: optionalUrlSchema,
    OWNER_OTP_ATTEMPT_LIMIT: integerEnvironmentSchema(5, 1, 10),
    OWNER_OTP_DAILY_PHONE_LIMIT: integerEnvironmentSchema(10, 1, 100),
    OWNER_OTP_HOURLY_PHONE_LIMIT: integerEnvironmentSchema(5, 1, 50),
    OWNER_OTP_NETWORK_WINDOW_LIMIT: integerEnvironmentSchema(10, 1, 100),
    OWNER_OTP_PROOF_TTL_SECONDS: integerEnvironmentSchema(300, 60, 900),
    OWNER_OTP_RESEND_SECONDS: integerEnvironmentSchema(60, 30, 300),
    OWNER_OTP_TTL_SECONDS: integerEnvironmentSchema(180, 60, 600),
    OWNER_NOTIFICATION_PROVIDER: z.enum(["mock", "solapi-sms", "kakao-alimtalk"]).default("mock"),
    SOLAPI_API_KEY: optionalApiKeySchema,
    SOLAPI_API_SECRET: optionalSecretSchema,
    SOLAPI_SMS_FROM: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^[0-9]{8,14}$/u)
        .optional(),
    ),
    OWNER_SESSION_TTL_SECONDS: integerEnvironmentSchema(43_200, 300, 86_400),
    OWNER_STAGING_MOCK_OTP: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^[0-9]{6}$/u)
        .optional(),
    ),
    OWNER_VERIFICATION_PROVIDER: z.enum(["mock", "solapi-sms", "unavailable"]).default("mock"),
    OWNER_WEB_PUSH_VAPID_PRIVATE_KEY: optionalSecretSchema,
    OWNER_WEB_PUSH_VAPID_PUBLIC_KEY: z.preprocess(
      emptyStringToUndefined,
      z.string().min(40).max(200).optional(),
    ),
    OWNER_WEB_PUSH_VAPID_SUBJECT: z.preprocess(
      emptyStringToUndefined,
      z.string().min(8).max(200).optional(),
    ),
    PUBLIC_QR_BASE_URL: optionalUrlSchema,
    PRIVACY_CLEANUP_DURATION_BUDGET_MS: integerEnvironmentSchema(45_000, 1_000, 55_000),
    PRIVACY_CLEANUP_TENANT_LIMIT: integerEnvironmentSchema(25, 1, 100),
    QR_CALL_COOLDOWN_SECONDS: integerEnvironmentSchema(180),
    QR_GLOBAL_LIMIT_PER_MINUTE: integerEnvironmentSchema(5, 1, 20),
    QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS: integerEnvironmentSchema(5_000, 1_000, 86_400_000),
    QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO: numberEnvironmentSchema(0.2, 0, 0.5),
    QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS: integerEnvironmentSchema(300_000, 1_000, 86_400_000),
    QR_GENERATION_DISPATCH_CLAIM_LIMIT: integerEnvironmentSchema(10, 1, 50),
    QR_GENERATION_DISPATCH_DURATION_BUDGET_MS: integerEnvironmentSchema(8_000, 1_000, 60_000),
    QR_GENERATION_DISPATCH_LEASE_SECONDS: integerEnvironmentSchema(60, 5, 300),
    QR_GENERATION_CHUNK_SIZE: integerEnvironmentSchema(50),
    QR_GENERATION_QUEUE_NAME: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^[a-z0-9](?:[a-z0-9_-]{0,62})$/u)
        .default("qr-generation"),
    ),
    QR_GENERATION_QUEUE_MAX_READ_COUNT: integerEnvironmentSchema(5, 1, 20),
    QR_GENERATION_QUEUE_POLL_INTERVAL_MS: integerEnvironmentSchema(1_000, 250, 60_000),
    QR_GENERATION_RENDER_CONCURRENCY: integerEnvironmentSchema(5, 1, 10),
    QR_PRINT_EXPORT_LOAD_CONCURRENCY: integerEnvironmentSchema(5, 1, 10),
    QR_PRINT_EXPORT_STORE_CONCURRENCY: integerEnvironmentSchema(1, 1, 4),
    QR_GENERATION_QUEUE_SEND_TIMEOUT_MS: integerEnvironmentSchema(3_000, 250, 10_000),
    QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS: integerEnvironmentSchema(3_600, 60, 86_400),
    QUEUE_WORKER_SECRET: optionalSecretSchema,
    RESPONSE_TOKEN_TTL_MINUTES: integerEnvironmentSchema(60),
    SENTRY_AUTH_TOKEN: optionalSecretSchema,
    SENTRY_DSN: optionalUrlSchema,
    STICKER_RENDER_CHUNK_SIZE: integerEnvironmentSchema(25),
    SUPABASE_SECRET_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().startsWith("sb_secret_").min(20).optional(),
    ),
    TEMP_PHONE_RETENTION_HOURS: integerEnvironmentSchema(24),
    TOKEN_REVOCATION_GRACE_HOURS: integerEnvironmentSchema(0, 0, 168),
    TOKEN_HMAC_KEY: optionalSecretSchema,
  })
  .superRefine((environment, context) => {
    if (
      environment.QR_GENERATION_QUEUE_SEND_TIMEOUT_MS >
      environment.QR_GENERATION_DISPATCH_DURATION_BUDGET_MS
    ) {
      context.addIssue({
        code: "custom",
        message: "Queue send timeout must not exceed the dispatch duration budget.",
        path: ["QR_GENERATION_QUEUE_SEND_TIMEOUT_MS"],
      });
    }

    if (
      environment.QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS <
      environment.QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS
    ) {
      context.addIssue({
        code: "custom",
        message: "Delivery retry max delay must not be below the base delay.",
        path: ["QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS"],
      });
    }

    if (
      environment.OWNER_OTP_HOURLY_PHONE_LIMIT > environment.OWNER_OTP_DAILY_PHONE_LIMIT ||
      environment.OWNER_OTP_RESEND_SECONDS >= environment.OWNER_OTP_TTL_SECONDS
    ) {
      context.addIssue({
        code: "custom",
        message: "Owner OTP policy windows are inconsistent.",
        path: ["OWNER_OTP_TTL_SECONDS"],
      });
    }

    if (environment.APP_ENV !== "production") {
      return;
    }

    const productionRequired = [
      "APP_ENCRYPTION_KEY_V1",
      "APP_URL",
      "COOKIE_SIGNING_KEY",
      "CRON_SECRET",
      "DATABASE_URL",
      "DIRECT_DATABASE_URL",
      "OWNER_RESPONSE_BASE_URL",
      "PUBLIC_QR_BASE_URL",
      "QR_GENERATION_QUEUE_NAME",
      "QUEUE_WORKER_SECRET",
      "SUPABASE_SECRET_KEY",
      "TOKEN_HMAC_KEY",
    ] as const;

    for (const key of productionRequired) {
      if (!environment[key]) {
        context.addIssue({
          code: "custom",
          message: `${key} is required in production.`,
          path: [key],
        });
      }
    }

    if (environment.OWNER_NOTIFICATION_PROVIDER === "mock") {
      context.addIssue({
        code: "custom",
        message: "Production requires an approved owner notification provider.",
        path: ["OWNER_NOTIFICATION_PROVIDER"],
      });
    }
    if (environment.OWNER_NOTIFICATION_PROVIDER === "solapi-sms") {
      for (const key of ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SMS_FROM"] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when SOLAPI SMS is enabled in production.`,
            path: [key],
          });
        }
      }
    }
    if (environment.OWNER_VERIFICATION_PROVIDER === "mock") {
      context.addIssue({
        code: "custom",
        message: "Production requires an approved owner verification provider.",
        path: ["OWNER_VERIFICATION_PROVIDER"],
      });
    }
    if (environment.OWNER_VERIFICATION_PROVIDER === "solapi-sms") {
      for (const key of ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SMS_FROM"] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when SOLAPI owner OTP is enabled in production.`,
            path: ["OWNER_VERIFICATION_PROVIDER"],
          });
        }
      }
    }
    if (environment.OWNER_STAGING_MOCK_OTP) {
      context.addIssue({
        code: "custom",
        message: "Production cannot use a staging mock OTP.",
        path: ["OWNER_STAGING_MOCK_OTP"],
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(input: NodeJS.ProcessEnv = process.env) {
  return serverEnvironmentSchema.parse(input);
}
