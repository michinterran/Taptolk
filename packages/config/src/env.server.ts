import { z } from "zod";
import {
  appEnvironmentSchema,
  integerEnvironmentSchema,
  optionalSecretSchema,
  optionalUrlSchema,
} from "./env.shared.js";

const serverEnvironmentSchema = z
  .object({
    APP_ENCRYPTION_KEY_V1: optionalSecretSchema,
    APP_ENV: appEnvironmentSchema.default("local"),
    APP_TIMEZONE: z.string().min(1).default("Asia/Seoul"),
    APP_URL: optionalUrlSchema,
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
    PUBLIC_QR_BASE_URL: optionalUrlSchema,
    QR_CALL_COOLDOWN_SECONDS: integerEnvironmentSchema(180),
    QR_GENERATION_CHUNK_SIZE: integerEnvironmentSchema(50),
    QUEUE_WORKER_SECRET: optionalSecretSchema,
    RESPONSE_TOKEN_TTL_MINUTES: integerEnvironmentSchema(60),
    SENTRY_AUTH_TOKEN: optionalSecretSchema,
    SENTRY_DSN: optionalUrlSchema,
    SMS_API_KEY: optionalSecretSchema,
    SMS_API_SECRET: optionalSecretSchema,
    SMS_PROVIDER: z.enum(["mock", "console", "naver-sens", "solapi"]).default("mock"),
    SMS_SENDER_NUMBER: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(8).optional(),
    ),
    SMS_SERVICE_ID: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    STICKER_RENDER_CHUNK_SIZE: integerEnvironmentSchema(25),
    SUPABASE_SERVICE_ROLE_KEY: optionalSecretSchema,
    TEMP_PHONE_RETENTION_HOURS: integerEnvironmentSchema(24),
    TOKEN_HMAC_KEY: optionalSecretSchema,
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV !== "production") {
      return;
    }

    const productionRequired = [
      "APP_ENCRYPTION_KEY_V1",
      "APP_URL",
      "COOKIE_SIGNING_KEY",
      "DATABASE_URL",
      "DIRECT_DATABASE_URL",
      "OWNER_RESPONSE_BASE_URL",
      "PUBLIC_QR_BASE_URL",
      "QUEUE_WORKER_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
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

    if (environment.SMS_PROVIDER === "mock" || environment.SMS_PROVIDER === "console") {
      context.addIssue({
        code: "custom",
        message: "Production requires an approved SMS provider.",
        path: ["SMS_PROVIDER"],
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(input: NodeJS.ProcessEnv = process.env) {
  return serverEnvironmentSchema.parse(input);
}
