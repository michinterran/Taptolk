import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import {
  ExponentialQrGenerationDeliveryRetryPolicy,
  QrGenerationDispatchCoordinator,
  QrGenerationDispatcherService,
} from "@taptolk/application";
import { createTaptolkAdminClient } from "@taptolk/auth";
import {
  createQrGenerationDispatcherRpcRepository,
  createSupabaseQrGenerationQueuePublisher,
  type QrGenerationDispatcherRpcClient,
  type SupabaseQueueClient,
} from "@taptolk/db";
import { decodeQrFromImage } from "@taptolk/qr-engine";
import {
  createStagingFixture,
  loadStagingEnvironment,
  type StagingFixture,
} from "./staging-fixture";

interface AcceptanceProvisioning {
  acceptance_label: string;
  batch_count: number;
  batch_ids: string[];
  design_id: string;
  job_count: number;
  job_ids: string[];
  quantity_per_batch: number;
  total_quantity: number;
}

interface QueueEvidence {
  active_total: number;
  archived_total: number;
  matching_active: number;
  matching_archived: number;
  poison_active: number;
  poison_archived: number;
}

interface BatchEvidence {
  failed_quantity: number;
  generated_quantity: number;
  id: string;
  passed_quantity: number;
  rendered_quantity: number;
  requested_quantity: number;
  status: string;
}

interface JobEvidence {
  execution_attempt_count: number;
  failed_count: number;
  id: string;
  passed_count: number;
  processed_count: number;
  status: string;
}

interface GenerationItemEvidence {
  generation_job_id: string;
  ordinal: number;
  qr_asset_id: string;
}

interface QrAssetEvidence {
  human_code: string;
  id: string;
  internal_uuid: string;
  public_token_hash: string;
  status: string;
}

interface ActivationEvidence {
  code_hash: string;
  qr_asset_id: string;
}

interface RenderEvidence {
  checksum_sha256: string;
  decoded_public_token_hash: string;
  preview_png_path: string;
  print_svg_path: string;
  qr_asset_id: string;
  quality_status: string;
}

interface ExportEvidence {
  byte_size: number;
  checksum_sha256: string;
  export_type: "CSV" | "MANIFEST" | "PDF" | "ZIP";
  qr_batch_id: string;
  status: string;
  storage_path: string;
}

const RUN_ACCEPTANCE = process.env.RUN_QR_GENERATION_ACCEPTANCE === "1";
const ARTIFACT_BUCKET = "qr-artifacts";
const QUEUE_NAME = "qr-generation";
const execFileAsync = promisify(execFile);

interface WorkerDriverResult {
  completedMessages: number;
  interruptedChunkItems: number;
  iterationRetryCount: number;
  poisonArchived: number;
  resumedReadCount: number;
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inFilter(values: readonly string[]): string {
  return `in.(${values.join(",")})`;
}

async function mapWithConcurrency<T>(
  itemCount: number,
  concurrency: number,
  operation: (index: number) => Promise<T>,
): Promise<T[]> {
  const results = new Array<T>(itemCount);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(itemCount, concurrency) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= itemCount) {
        return;
      }
      results[index] = await operation(index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function removeStoredArtifacts(
  client: ReturnType<typeof createTaptolkAdminClient>,
  paths: readonly string[],
): Promise<void> {
  const distinctPaths = [...new Set(paths)];
  for (let offset = 0; offset < distinctPaths.length; offset += 50) {
    const chunk = distinctPaths.slice(offset, offset + 50);
    let removed = false;
    for (let attempt = 1; attempt <= 3 && !removed; attempt += 1) {
      const removal = await client.storage.from(ARTIFACT_BUCKET).remove(chunk);
      if (!removal.error) {
        removed = true;
      } else if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (!removed) {
      throw new Error("Acceptance artifact cleanup failed.");
    }
  }
}

async function removeAcceptanceBatchArtifacts(
  client: ReturnType<typeof createTaptolkAdminClient>,
  tenantId: string,
  batchIds: readonly string[],
): Promise<void> {
  const prefixes = batchIds.flatMap((batchId) => [
    `${tenantId}/batches/${batchId}/generation-1`,
    `${tenantId}/batches/${batchId}/exports-1`,
  ]);
  for (const prefix of prefixes) {
    const listed = await client.storage.from(ARTIFACT_BUCKET).list(prefix, {
      limit: 1_000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (listed.error) {
      throw new Error("Acceptance artifact residue inspection failed.");
    }
    const paths = listed.data.map(({ name }) => `${prefix}/${name}`);
    if (paths.length > 0) {
      await removeStoredArtifacts(client, paths);
    }
    const verified = await client.storage.from(ARTIFACT_BUCKET).list(prefix, {
      limit: 1,
      offset: 0,
    });
    if (verified.error || verified.data.length !== 0) {
      throw new Error("Acceptance artifact residue remained.");
    }
  }
}

test.describe
  .serial("Phase 3 real 10x100 Worker Queue export staging acceptance", () => {
    test.skip(!RUN_ACCEPTANCE, "Run only through the explicit staging acceptance command.");
    test.setTimeout(90 * 60_000);

    test("generates 1,000 items, resumes one expired lease, verifies exports, and leaves zero residue", async () => {
      const environment = loadStagingEnvironment();
      const client = createTaptolkAdminClient({
        secretKey: environment.secretKey,
        url: environment.supabaseUrl,
      });
      const acceptanceLabel = `QR1K-${randomBytes(6).toString("hex").toUpperCase()}`;
      let fixture: StagingFixture | null = null;
      let jobIds: string[] = [];
      let storedPaths: string[] = [];
      let cleanupStarted = false;

      try {
        const preflight = await new (class {
          async inspect(): Promise<QueueEvidence> {
            fixture = await createStagingFixture();
            return fixture.api.rpc<QueueEvidence>(
              "inspect_qr_generation_staging_acceptance_queue",
              {
                p_acceptance_label: acceptanceLabel,
                p_job_ids: [],
              },
            );
          }
        })().inspect();
        expect(preflight.active_total).toBe(0);

        const provisioned = await fixture.api.rpc<AcceptanceProvisioning>(
          "provision_qr_generation_staging_acceptance",
          {
            p_acceptance_label: acceptanceLabel,
            p_approver_id: fixture.actors.superAdmin.id,
            p_management_company_id: fixture.companyAId,
            p_requester_id: fixture.actors.siteAdmin.id,
            p_site_id: fixture.sites.companyAFirst.id,
            p_tenant_id: fixture.tenantAId,
          },
        );
        expect(provisioned).toMatchObject({
          acceptance_label: acceptanceLabel,
          batch_count: 10,
          job_count: 10,
          quantity_per_batch: 100,
          total_quantity: 1000,
        });
        expect(provisioned.batch_ids).toHaveLength(10);
        expect(uniqueCount(provisioned.batch_ids)).toBe(10);
        expect(provisioned.job_ids).toHaveLength(10);
        expect(uniqueCount(provisioned.job_ids)).toBe(10);
        jobIds = provisioned.job_ids;

        const rpcClient: QrGenerationDispatcherRpcClient = {
          async rpc(functionName, parameters) {
            const result = await client.rpc(functionName, parameters);
            return {
              data: result.data,
              error: result.error
                ? { code: result.error.code, message: result.error.message }
                : null,
            };
          },
        };
        const commands = new QrGenerationDispatcherService(
          createQrGenerationDispatcherRpcRepository(rpcClient),
        );
        const publisher = createSupabaseQrGenerationQueuePublisher(
          client as unknown as SupabaseQueueClient,
          { queueName: QUEUE_NAME, requestTimeoutMs: 10_000 },
        );
        const dispatcher = new QrGenerationDispatchCoordinator(
          commands,
          publisher,
          new ExponentialQrGenerationDeliveryRetryPolicy({
            baseDelayMs: 1_000,
            jitterRatio: 0,
            maxDelayMs: 1_000,
          }),
        );
        const dispatched = await dispatcher.runOnce({ leaseSeconds: 60, limit: 10 });
        expect(dispatched.claimedCount).toBe(10);
        expect(dispatched.outcomes).toHaveLength(10);
        expect(dispatched.outcomes.every(({ status }) => status === "PUBLISHED")).toBe(true);

        const workerProcess = await execFileAsync(
          process.execPath,
          ["apps/worker/dist/acceptance/qr-generation-staging-driver.js"],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              TAPTOLK_QR_ACCEPTANCE_LABEL: acceptanceLabel,
            },
            maxBuffer: 1024 * 1024,
            timeout: 75 * 60_000,
          },
        );
        const workerResult = JSON.parse(workerProcess.stdout.trim()) as WorkerDriverResult;
        expect(workerResult).toMatchObject({
          completedMessages: 10,
          interruptedChunkItems: 50,
          poisonArchived: 1,
        });
        expect(workerResult.resumedReadCount).toBeGreaterThanOrEqual(2);

        const [batches, jobs, generationItems, assets, activations, renders, exports] =
          await Promise.all([
            fixture.api.select<BatchEvidence>(
              "qr_batches",
              `id=${inFilter(provisioned.batch_ids)}&select=id,requested_quantity,generated_quantity,rendered_quantity,passed_quantity,failed_quantity,status&order=batch_code.asc`,
            ),
            fixture.api.select<JobEvidence>(
              "qr_generation_jobs",
              `id=${inFilter(jobIds)}&select=id,status,execution_attempt_count,processed_count,passed_count,failed_count&order=created_at.asc`,
            ),
            fixture.api.select<GenerationItemEvidence>(
              "qr_generation_items",
              `generation_job_id=${inFilter(jobIds)}&select=generation_job_id,ordinal,qr_asset_id`,
            ),
            fixture.api.select<QrAssetEvidence>(
              "qr_assets",
              `batch_id=${inFilter(provisioned.batch_ids)}&select=id,internal_uuid,public_token_hash,human_code,status`,
            ),
            fixture.api.select<ActivationEvidence>(
              "qr_activation_codes",
              `tenant_id=eq.${fixture.tenantAId}&select=qr_asset_id,code_hash`,
            ),
            fixture.api.select<RenderEvidence>(
              "rendered_assets",
              `tenant_id=eq.${fixture.tenantAId}&select=qr_asset_id,preview_png_path,print_svg_path,checksum_sha256,quality_status,decoded_public_token_hash`,
            ),
            fixture.api.select<ExportEvidence>(
              "print_exports",
              `qr_batch_id=${inFilter(provisioned.batch_ids)}&select=qr_batch_id,export_type,storage_path,checksum_sha256,byte_size,status`,
            ),
          ]);

        expect(batches).toHaveLength(10);
        expect(
          batches.every(
            (batch) =>
              batch.requested_quantity === 100 &&
              batch.generated_quantity === 100 &&
              batch.rendered_quantity === 100 &&
              batch.passed_quantity === 100 &&
              batch.failed_quantity === 0 &&
              batch.status === "PRINT_FILE_READY",
          ),
        ).toBe(true);
        expect(jobs).toHaveLength(10);
        expect(
          jobs.every(
            (job) =>
              job.status === "COMPLETED" &&
              job.processed_count === 100 &&
              job.passed_count === 100 &&
              job.failed_count === 0 &&
              job.execution_attempt_count === 1,
          ),
        ).toBe(true);
        expect(generationItems).toHaveLength(1000);
        expect(assets).toHaveLength(1000);
        expect(activations).toHaveLength(1000);
        expect(renders).toHaveLength(1000);

        for (const jobId of jobIds) {
          const ordinals = generationItems
            .filter(({ generation_job_id }) => generation_job_id === jobId)
            .map(({ ordinal }) => ordinal);
          expect(ordinals).toHaveLength(100);
          expect(new Set(ordinals).size).toBe(100);
          expect(Math.min(...ordinals)).toBe(1);
          expect(Math.max(...ordinals)).toBe(100);
        }
        expect(uniqueCount(generationItems.map(({ qr_asset_id }) => qr_asset_id))).toBe(1000);
        expect(uniqueCount(assets.map(({ id }) => id))).toBe(1000);
        expect(uniqueCount(assets.map(({ internal_uuid }) => internal_uuid))).toBe(1000);
        expect(uniqueCount(assets.map(({ public_token_hash }) => public_token_hash))).toBe(1000);
        expect(uniqueCount(assets.map(({ human_code }) => human_code))).toBe(1000);
        expect(uniqueCount(activations.map(({ qr_asset_id }) => qr_asset_id))).toBe(1000);
        expect(uniqueCount(activations.map(({ code_hash }) => code_hash))).toBe(1000);
        expect(
          renders.every(
            (render) =>
              render.quality_status === "PASSED" &&
              render.decoded_public_token_hash ===
                assets.find(({ id }) => id === render.qr_asset_id)?.public_token_hash,
          ),
        ).toBe(true);

        const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
        const decodedCount = (
          await mapWithConcurrency(renders.length, 8, async (index) => {
            const render = renders[index];
            if (!render) {
              throw new Error("Missing render evidence.");
            }
            const download = await client.storage
              .from(ARTIFACT_BUCKET)
              .download(render.preview_png_path);
            if (download.error) {
              throw new Error("QR decode artifact download failed.");
            }
            const decodedUrl = await decodeQrFromImage(
              new Uint8Array(await download.data.arrayBuffer()),
            );
            if (!decodedUrl) {
              return false;
            }
            const token = new URL(decodedUrl).pathname.split("/").filter(Boolean).at(-1);
            const asset = assetsById.get(render.qr_asset_id);
            return Boolean(token && asset && sha256(token) === asset.public_token_hash);
          })
        ).filter(Boolean).length;
        expect(decodedCount).toBe(1000);

        expect(exports).toHaveLength(40);
        const expectedExportTypes = ["CSV", "MANIFEST", "PDF", "ZIP"];
        for (const batchId of provisioned.batch_ids) {
          const batchExports = exports.filter(({ qr_batch_id }) => qr_batch_id === batchId);
          expect(batchExports.map(({ export_type }) => export_type).sort()).toEqual(
            expectedExportTypes,
          );
        }
        const exportLedgerVerified = (
          await mapWithConcurrency(exports.length, 8, async (index) => {
            const item = exports[index];
            if (!item) {
              throw new Error("Missing export evidence.");
            }
            const download = await client.storage.from(ARTIFACT_BUCKET).download(item.storage_path);
            if (download.error) {
              throw new Error("Export artifact download failed.");
            }
            const bytes = new Uint8Array(await download.data.arrayBuffer());
            if (
              item.status !== "READY" ||
              bytes.byteLength !== item.byte_size ||
              sha256(bytes) !== item.checksum_sha256
            ) {
              return false;
            }
            if (item.export_type === "MANIFEST") {
              const manifest = JSON.parse(new TextDecoder().decode(bytes)) as {
                files?: unknown[];
                itemCount?: number;
                schemaVersion?: number;
              };
              return (
                manifest.schemaVersion === 1 &&
                manifest.itemCount === 100 &&
                manifest.files?.length === 100
              );
            }
            if (item.export_type === "CSV") {
              return new TextDecoder().decode(bytes).split("\n").length === 101;
            }
            return true;
          })
        ).every(Boolean);
        expect(exportLedgerVerified).toBe(true);

        const queueEvidence = await fixture.api.rpc<QueueEvidence>(
          "inspect_qr_generation_staging_acceptance_queue",
          {
            p_acceptance_label: acceptanceLabel,
            p_job_ids: jobIds,
          },
        );
        expect(queueEvidence.active_total).toBe(0);
        expect(queueEvidence.matching_active).toBe(0);
        expect(queueEvidence.poison_active).toBe(0);
        expect(queueEvidence.matching_archived).toBe(11);
        expect(queueEvidence.poison_archived).toBe(1);

        storedPaths = [
          ...renders.flatMap(({ preview_png_path, print_svg_path }) => [
            preview_png_path,
            print_svg_path,
          ]),
          ...exports.map(({ storage_path }) => storage_path),
        ];
        cleanupStarted = true;
        await removeStoredArtifacts(client, storedPaths);
        await removeAcceptanceBatchArtifacts(client, fixture.tenantAId, provisioned.batch_ids);
        await fixture.api.rpc("cleanup_qr_generation_staging_acceptance_queue", {
          p_acceptance_label: acceptanceLabel,
          p_job_ids: jobIds,
        });
        const actorIds = Object.values(fixture.actors).map(({ id }) => id);
        await fixture.cleanup();

        const afterQueueCleanup = await fixture.api.rpc<QueueEvidence>(
          "inspect_qr_generation_staging_acceptance_queue",
          {
            p_acceptance_label: acceptanceLabel,
            p_job_ids: jobIds,
          },
        );
        expect(afterQueueCleanup.active_total).toBe(0);
        expect(afterQueueCleanup.matching_active).toBe(0);
        expect(afterQueueCleanup.matching_archived).toBe(0);
        expect(
          await Promise.all(actorIds.map((actorId) => fixture?.api.authUserExists(actorId))),
        ).toEqual([false, false, false]);
        expect(
          await fixture.api.select<{ id: string }>(
            "tenants",
            `id=in.(${fixture.tenantAId},${fixture.tenantBId})&select=id`,
          ),
        ).toEqual([]);

        console.log(
          "[qr-generation-acceptance] batches=10 quantity=100 total=1000 duplicates=0 decode=1000/1000 exports=40 checksums=40/40 queue_retry=1 queue_archive=11 poison_active=0 residue=0",
        );
      } finally {
        if (fixture && !cleanupStarted) {
          if (storedPaths.length === 0) {
            const [renderRows, exportRows] = await Promise.all([
              fixture.api
                .select<Pick<RenderEvidence, "preview_png_path" | "print_svg_path">>(
                  "rendered_assets",
                  `tenant_id=eq.${fixture.tenantAId}&select=preview_png_path,print_svg_path`,
                )
                .catch(() => []),
              fixture.api
                .select<Pick<ExportEvidence, "storage_path">>(
                  "print_exports",
                  `tenant_id=eq.${fixture.tenantAId}&select=storage_path`,
                )
                .catch(() => []),
            ]);
            storedPaths = [
              ...renderRows.flatMap(({ preview_png_path, print_svg_path }) => [
                preview_png_path,
                print_svg_path,
              ]),
              ...exportRows.map(({ storage_path }) => storage_path),
            ];
          }
          await removeStoredArtifacts(client, storedPaths).catch(() => undefined);
          if (jobIds.length > 0) {
            const batchRows = await fixture.api
              .select<{ qr_batch_id: string }>(
                "qr_generation_jobs",
                `id=${inFilter(jobIds)}&select=qr_batch_id`,
              )
              .catch(() => []);
            await removeAcceptanceBatchArtifacts(
              client,
              fixture.tenantAId,
              batchRows.map(({ qr_batch_id }) => qr_batch_id),
            ).catch(() => undefined);
          }
          if (jobIds.length > 0) {
            await fixture.api
              .rpc("cleanup_qr_generation_staging_acceptance_queue", {
                p_acceptance_label: acceptanceLabel,
                p_job_ids: jobIds,
              })
              .catch(() => undefined);
          }
          await fixture.cleanup().catch(() => undefined);
        }
      }
    });
  });
