import {
  QR_GENERATION_QUEUE_JOB_TYPE,
  QR_GENERATION_QUEUE_SCHEMA_VERSION,
  type QrGenerationQueueMessage,
} from "@taptolk/application";
import { z } from "zod";

export const QUEUE_JOB_SCHEMA_VERSION = QR_GENERATION_QUEUE_SCHEMA_VERSION;
export { QR_GENERATION_QUEUE_JOB_TYPE };

export const queueJobSchema: z.ZodType<QrGenerationQueueMessage> = z
  .object({
    batchId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    deliveryAttempt: z.number().int().min(1),
    generationRevision: z.number().int().min(1),
    jobId: z.string().uuid(),
    jobType: z.literal(QR_GENERATION_QUEUE_JOB_TYPE),
    schemaVersion: z.literal(QUEUE_JOB_SCHEMA_VERSION),
    siteId: z.string().uuid(),
    tenantId: z.string().uuid(),
    traceId: z.string().uuid(),
  })
  .strict();

export type QueueJob = z.infer<typeof queueJobSchema>;

export type QueueJobHandler = (job: QueueJob) => Promise<void>;
export type QueueJobRegistry = Readonly<Partial<Record<QueueJob["jobType"], QueueJobHandler>>>;

export async function processQueueJob(
  input: unknown,
  registry: QueueJobRegistry,
): Promise<QueueJob> {
  const job = queueJobSchema.parse(input);
  const handler = registry[job.jobType];

  if (!handler) {
    throw new Error(`Unsupported queue job type: ${job.jobType}`);
  }

  await handler(job);
  return job;
}
