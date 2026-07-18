import { z } from "zod";

export const queueJobSchema = z.object({
  attempt: z.number().int().min(0),
  createdAt: z.string().datetime(),
  jobId: z.string().uuid(),
  jobType: z.string().min(1),
  resourceId: z.string().uuid(),
  siteId: z.string().uuid().nullable(),
  tenantId: z.string().uuid(),
  traceId: z.string().uuid(),
});

export type QueueJob = z.infer<typeof queueJobSchema>;

export type QueueJobHandler = (job: QueueJob) => Promise<void>;
export type QueueJobRegistry = Readonly<Record<string, QueueJobHandler>>;

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
