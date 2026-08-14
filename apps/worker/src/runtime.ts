import { createHash } from "node:crypto";
import { createTaptolkAdminClient } from "@taptolk/auth";
import { parseClientEnvironment, parseServerEnvironment } from "@taptolk/config";
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
  type QrQueueIterationResult,
  runQrQueueIteration,
  type SupabasePgmqClient,
  SupabasePgmqQueue,
} from "./pgmq-queue-runtime.js";
import { resolveQrCredentialEncryption } from "./qr-credential-encryption.js";

export const QR_GENERATION_VERCEL_FUNCTION_VISIBILITY_TIMEOUT_SECONDS = 300;

export type QrQueueWorkerRequiredVariable =
  | "APP_ENCRYPTION_KEY_V1"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "PUBLIC_QR_BASE_URL"
  | "SUPABASE_SECRET_KEY";

export type QrQueueWorkerRuntimeInitialization =
  | {
      missingVariables: readonly QrQueueWorkerRequiredVariable[];
      ready: false;
    }
  | {
      ready: true;
      runOnce(): Promise<QrQueueIterationResult>;
    };

function listMissingVariables(input: NodeJS.ProcessEnv): readonly QrQueueWorkerRequiredVariable[] {
  const missing: QrQueueWorkerRequiredVariable[] = [];
  if (!input.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!input.SUPABASE_SECRET_KEY) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  if (!input.APP_ENCRYPTION_KEY_V1 && !input.QR_CREDENTIAL_ENCRYPTION_KEY_V2) {
    missing.push("APP_ENCRYPTION_KEY_V1");
  }
  if (!input.PUBLIC_QR_BASE_URL) {
    missing.push("PUBLIC_QR_BASE_URL");
  }
  return missing;
}

export async function createQrQueueWorkerRuntime(
  input: NodeJS.ProcessEnv = process.env,
  options: {
    taptolkLogoDataUri?: string;
    visibilityTimeoutSeconds?: number;
  } = {},
): Promise<QrQueueWorkerRuntimeInitialization> {
  const missingVariables = listMissingVariables(input);
  if (missingVariables.length > 0) {
    return { missingVariables, ready: false };
  }

  const environment = parseServerEnvironment(input);
  const clientEnvironment = parseClientEnvironment(input);
  const credentialEncryption = resolveQrCredentialEncryption(environment);
  if (
    !clientEnvironment.NEXT_PUBLIC_SUPABASE_URL ||
    !environment.SUPABASE_SECRET_KEY ||
    !credentialEncryption ||
    !environment.PUBLIC_QR_BASE_URL
  ) {
    return { missingVariables: [], ready: false };
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
        .update(`qr-credential-encryption\0${credentialEncryption.secret}`, "utf8")
        .digest(),
      keyVersion: credentialEncryption.keyVersion,
      publicQrBaseUrl: environment.PUBLIC_QR_BASE_URL,
      renderConcurrency: environment.QR_GENERATION_RENDER_CONCURRENCY,
      taptolkLogoDataUri: options.taptolkLogoDataUri ?? (await readWorkerTaptolkLogoDataUri()),
    },
  );
  const printRuntime = new SupabaseQrPrintExportRuntime(client);
  const execution = new QrWorkerExecutionRuntime(
    generation,
    new QrPrintExportHandler(printRuntime, printRuntime, {
      loadConcurrency: environment.QR_PRINT_EXPORT_LOAD_CONCURRENCY,
      storeConcurrency: environment.QR_PRINT_EXPORT_STORE_CONCURRENCY,
    }),
    new SupabaseQrWorkerFailureRepository(client),
  );
  const queue = new SupabasePgmqQueue(
    client as unknown as SupabasePgmqClient,
    environment.QR_GENERATION_QUEUE_NAME,
    options.visibilityTimeoutSeconds ?? environment.QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  );

  return {
    ready: true,
    runOnce() {
      return runQrQueueIteration(queue, execution, environment.QR_GENERATION_QUEUE_MAX_READ_COUNT);
    },
  };
}
