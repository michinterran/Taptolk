import { z } from "zod";

export const QR_GENERATION_PIPELINE_TOPIC = "qr-generation-pipeline-v1";
export const QR_GENERATION_PIPELINE_WAKE_SCHEMA_VERSION = 1;

const wakeSchema = z
  .object({
    batchId: z.string().uuid(),
    requestId: z.string().uuid(),
    schemaVersion: z.literal(QR_GENERATION_PIPELINE_WAKE_SCHEMA_VERSION),
  })
  .strict();

export type QrGenerationPipelineWake = z.infer<typeof wakeSchema>;

export function parseQrGenerationPipelineWake(input: unknown): QrGenerationPipelineWake {
  return wakeSchema.parse(input);
}
