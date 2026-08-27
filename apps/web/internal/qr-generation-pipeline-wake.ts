import "server-only";

import { send } from "@vercel/queue";
import {
  parseQrGenerationPipelineWake,
  QR_GENERATION_PIPELINE_TOPIC,
  QR_GENERATION_PIPELINE_WAKE_SCHEMA_VERSION,
} from "./qr-generation-pipeline-contract";

export async function enqueueQrGenerationPipelineWake(input: {
  batchId: string;
  requestId: string;
}): Promise<void> {
  if ((process.env.APP_ENV ?? "local") === "local") {
    return;
  }

  const wake = parseQrGenerationPipelineWake({
    ...input,
    schemaVersion: QR_GENERATION_PIPELINE_WAKE_SCHEMA_VERSION,
  });
  await send(QR_GENERATION_PIPELINE_TOPIC, wake, {
    delaySeconds: 5,
    idempotencyKey: `qr-generation-approval-${wake.requestId}-${wake.batchId}`,
    retentionSeconds: 86_400,
  });
}
