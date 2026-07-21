import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  auditPayloadIsSafe,
  createStagingFixture,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

interface DesignRow {
  approved_by: string | null;
  created_by: string;
  id: string;
  site_id: string;
  status: "APPROVED" | "ARCHIVED" | "DRAFT";
  version: number;
}

interface BatchRow {
  id: string;
  requested_by: string;
  site_id: string;
  status:
    | "CANCELLED"
    | "DELIVERED"
    | "DISTRIBUTING"
    | "DRAFT"
    | "FINAL_APPROVAL_PENDING"
    | "GENERATION_APPROVED"
    | "GENERATION_QUEUED"
    | "PRINT_FILE_READY"
    | "PRINTED"
    | "SAMPLE_APPROVED"
    | "SAMPLE_READY"
    | "SENT_TO_PRINTER"
    | "SHIPPED";
  version: number;
}

interface RaceBatchRow extends BatchRow {
  batch_code: string;
}

interface SampleRow {
  approved_by: string | null;
  id: string;
  invalidated_by: string | null;
  status: "APPROVED" | "INVALIDATED" | "READY";
  version: number;
}

interface AuditRow {
  action: string;
  actor_id: string | null;
  after_data: unknown;
  before_data: unknown;
}

interface GenerationJobRow {
  approval_request_id: string;
  available_at?: string;
  delivery_attempt_count: number;
  execution_attempt_count: number;
  generation_revision: number;
  id: string;
  last_error_code?: string | null;
  lease_expires_at?: string | null;
  queue_message_id: string | null;
  qr_batch_id: string;
  status: "DELIVERY_LEASED" | "PENDING_DELIVERY" | "QUEUED" | "RETRY_WAIT";
  version?: number;
}

interface GenerationDeliveryResult {
  batchId: string;
  batchStatus: "GENERATION_APPROVED" | "GENERATION_QUEUED";
  batchVersion: number;
  deliveryAttemptCount: number;
  jobId: string;
  jobStatus: "QUEUED" | "RETRY_WAIT";
  jobVersion: number;
}

interface QrAssetRow {
  batch_id: string;
  current_binding_id: string | null;
  current_vehicle_id: string | null;
  human_code: string;
  id: string;
  status: "ASSIGNED" | "IN_STOCK" | "PRINTED" | "PRINT_READY" | "REPLACED" | "REVOKED";
  version: number;
}

interface VehicleImportRow {
  committed_at: string | null;
  id: string;
  original_deleted_at: string;
  row_count: number;
  source_checksum_sha256: string;
  status: "COMMITTED" | "VALIDATED";
  version: number;
}

interface QrBindingRow {
  assignment_method: "CSV_IMPORT" | "MANUAL" | "REPLACEMENT";
  ended_at: string | null;
  id: string;
  qr_asset_id: string;
  vehicle_id: string;
}

interface InventoryTransactionRow {
  qr_asset_id: string | null;
  quantity: number;
  transaction_type: "ASSIGN" | "RECEIVE" | "REPLACE" | "REVOKE";
}

interface GenerationClaim {
  batchId: string;
  createdAt: string;
  deliveryAttemptCount: number;
  generationRevision: number;
  jobId: string;
  jobStatus: "DELIVERY_LEASED";
  jobType: "QR_GENERATION";
  jobVersion: number;
  leaseExpiresAt: string;
  siteId: string;
  tenantId: string;
}

let fixture: StagingFixture;
let designId = "";
let batchId = "";
let sampleId = "";
let generationJobId = "";
let phase4Assets: QrAssetRow[] = [];
let vehicleImportId = "";

async function signInAdmin(page: Page, actor: StagingActor, locale: "en" | "ko") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin(?:/(?:platform|dashboard))?$`, "u"), {
    timeout: 15_000,
  });
}

function cardWithText(page: Page, text: string): Locator {
  return page.locator(".admin-approval-card").filter({ hasText: text });
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inventoryAssetForm(page: Page, humanCode: string, buttonName: string): Locator {
  return cardWithText(page, humanCode)
    .filter({ has: page.getByRole("button", { name: buttonName }) })
    .first();
}

async function expectAuditActors(
  resourceId: string,
  actions: readonly string[],
  actors: readonly string[],
) {
  const rows = await fixture.api.select<AuditRow>(
    "audit_logs",
    `resource_id=eq.${encodeURIComponent(resourceId)}&select=action,actor_id,before_data,after_data&order=created_at.asc`,
  );
  expect(rows.map(({ action }) => action)).toEqual(actions);
  expect(rows.map(({ actor_id }) => actor_id)).toEqual(actors);
  expect(rows.every((row) => auditPayloadIsSafe([row.before_data, row.after_data]))).toBe(true);
}

async function expectNoRows(table: string, siteIds: readonly string[]) {
  const rows = await fixture.api.select<{ id: string }>(
    table,
    `site_id=in.(${siteIds.join(",")})&select=id`,
  );
  expect(rows).toEqual([]);
}

test.describe
  .serial("authenticated staging QR inventory sample foundation", () => {
    test.beforeAll(async () => {
      fixture = await createStagingFixture();
    });

    test.afterAll(async () => {
      await fixture?.cleanup();
    });

    test("Management Admin creates a scoped Design and cross-tenant tampering is denied", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.managementAdmin, "ko");
      await page.goto("/ko/admin/qr-inventory");
      await expect(
        page.getByText(
          "샘플 승인과 최종 승인은 서로 다른 단계입니다. Super Admin 최종 승인은 durable 생성 작업을 준비하지만, 아직 Queue 전달이나 QR 생성을 시작하지 않습니다.",
        ),
      ).toBeVisible();

      await page.getByText("Sticker Design Version 만들기", { exact: true }).click();
      const createButton = page.getByRole("button", { name: "디자인 DRAFT 생성" });
      const createForm = createButton.locator("xpath=ancestor::form");
      const siteSelect = createForm.locator('select[name="siteScope"]');
      await siteSelect
        .locator("option")
        .first()
        .evaluate((option, value) => {
          (option as HTMLOptionElement).value = value;
        }, `${fixture.tenantBId}|${fixture.companyBId}|${fixture.sites.tenantB.id}|1|ACTIVE`);
      await createForm
        .locator('select[name="templateCode"]')
        .selectOption("ROUND_WHITE_MINIMAL_V1");
      await createForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging cross tenant denial");
      await createButton.click();
      await expect(page).toHaveURL(/error=forbidden/u);

      await page.goto("/ko/admin/qr-inventory");
      await page.getByText("Sticker Design Version 만들기", { exact: true }).click();
      const validButton = page.getByRole("button", { name: "디자인 DRAFT 생성" });
      const validForm = validButton.locator("xpath=ancestor::form");
      await validForm
        .locator('select[name="siteScope"]')
        .selectOption(
          `${fixture.tenantAId}|${fixture.companyAId}|${fixture.sites.companyAFirst.id}|1|ACTIVE`,
        );
      await validForm.locator('select[name="templateCode"]').selectOption("ROUND_WHITE_MINIMAL_V1");
      await validForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging Design creation");
      await validButton.click();
      await expect(page).toHaveURL(/status=designCreated/u);
      await expect(
        page.getByText("Sticker Design DRAFT가 검토 대기열에 추가되었습니다.", {
          exact: true,
        }),
      ).toBeVisible();

      const designs = await fixture.api.select<DesignRow>(
        "sticker_design_versions",
        `site_id=eq.${fixture.sites.companyAFirst.id}&select=id,site_id,status,created_by,approved_by,version`,
      );
      expect(designs).toHaveLength(1);
      designId = designs[0].id;
      expect(designs[0]).toMatchObject({
        approved_by: null,
        created_by: fixture.actors.managementAdmin.id,
        status: "DRAFT",
      });
    });

    test("Super Admin independently approves the Design", async ({ page }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const designCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByRole("button", { name: "Approve independently" }),
        })
        .first();
      await expect(designCard).toBeVisible();
      await designCard
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging independent Design approval");
      await designCard.getByRole("button", { name: "Approve independently" }).click();
      await expect(page).toHaveURL(/status=designApproved/u);

      const designs = await fixture.api.select<DesignRow>(
        "sticker_design_versions",
        `id=eq.${designId}&select=id,site_id,status,created_by,approved_by,version`,
      );
      expect(designs[0]).toMatchObject({
        approved_by: fixture.actors.superAdmin.id,
        created_by: fixture.actors.managementAdmin.id,
        status: "APPROVED",
      });
      expect(designs[0].approved_by).not.toBe(designs[0].created_by);
      await expectAuditActors(
        designId,
        ["STICKER_DESIGN_CREATED", "STICKER_DESIGN_APPROVED"],
        [fixture.actors.managementAdmin.id, fixture.actors.superAdmin.id],
      );
    });

    test("Site Admin requests only its exact-Site Batch", async ({ page }) => {
      await signInAdmin(page, fixture.actors.siteAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const requestButton = page.getByRole("button", { name: "Request small Batch" });
      const requestForm = requestButton.locator("xpath=ancestor::form");
      await requestForm.locator('input[name="siteId"]').evaluate((input, siteId) => {
        (input as HTMLInputElement).value = siteId;
      }, fixture.sites.companyASecond.id);
      await requestForm.locator('input[name="expectedSiteVersion"]').evaluate((input) => {
        (input as HTMLInputElement).value = "1";
      });
      await requestForm.locator('input[name="quantity"]').fill("20");
      await requestForm.locator('input[name="purpose"]').fill("Resident sample distribution");
      await requestForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging sibling Site denial");
      await requestButton.click();
      await expect(page).toHaveURL(/error=forbidden/u);

      await page.goto("/en/admin/qr-inventory");
      const validButton = page.getByRole("button", { name: "Request small Batch" });
      const validForm = validButton.locator("xpath=ancestor::form");
      await validForm.locator('input[name="quantity"]').fill("20");
      await validForm.locator('input[name="purpose"]').fill("Resident sample distribution");
      await validForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging small Batch request");
      await validButton.click();
      await expect(page).toHaveURL(/status=batchRequested/u);

      const batches = await fixture.api.select<BatchRow>(
        "qr_batches",
        `site_id=eq.${fixture.sites.companyAFirst.id}&select=id,site_id,status,requested_by,version`,
      );
      expect(batches).toHaveLength(1);
      batchId = batches[0].id;
      expect(batches[0]).toMatchObject({
        requested_by: fixture.actors.siteAdmin.id,
        status: "DRAFT",
      });
    });

    test("Super Admin attaches and independently approves a passing sample", async ({ page }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const batchCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByText("Waiting for sample", { exact: true }),
        })
        .first();
      await batchCard.getByText("Attach sample artifact", { exact: true }).first().click();
      const attachForm = batchCard.locator("form").filter({
        has: page.getByRole("button", { name: "Attach sample artifact" }),
      });
      await attachForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging sample attachment");
      await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
      await expect(page).toHaveURL(/status=sampleGenerated/u);

      const samples = await fixture.api.select<SampleRow>(
        "qr_batch_samples",
        `batch_id=eq.${batchId}&select=id,status,approved_by,invalidated_by,version`,
      );
      expect(samples).toHaveLength(1);
      sampleId = samples[0].id;
      expect(samples[0].status).toBe("READY");

      const approvalCard = page.locator(".admin-approval-card").filter({
        has: page.getByRole("button", { name: "Approve sample independently" }),
      });
      await approvalCard
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging independent sample approval");
      await approvalCard.getByRole("button", { name: "Approve sample independently" }).click();
      await expect(page).toHaveURL(/status=sampleApproved/u);

      const approvedBatch = await fixture.api.select<BatchRow>(
        "qr_batches",
        `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
      );
      const approvedSample = await fixture.api.select<SampleRow>(
        "qr_batch_samples",
        `id=eq.${sampleId}&select=id,status,approved_by,invalidated_by,version`,
      );
      expect(approvedBatch[0].status).toBe("SAMPLE_APPROVED");
      expect(approvedSample[0]).toMatchObject({
        approved_by: fixture.actors.superAdmin.id,
        status: "APPROVED",
      });
      expect(approvedSample[0].approved_by).not.toBe(approvedBatch[0].requested_by);
    });

    test("sample invalidation preserves history and returns the Batch to DRAFT", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "ko");
      await page.goto("/ko/admin/qr-inventory");
      const batchCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByText("샘플 승인", { exact: true }),
        })
        .first();
      await batchCard.getByText("샘플 무효화", { exact: true }).first().click();
      const invalidationForm = batchCard.locator("form").filter({
        has: page.getByRole("button", { name: "샘플 무효화" }),
      });
      await invalidationForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging sample invalidation");
      await invalidationForm.getByRole("button", { name: "샘플 무효화" }).click();
      await expect(page).toHaveURL(/status=sampleInvalidated/u);

      const batch = await fixture.api.select<BatchRow>(
        "qr_batches",
        `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
      );
      const sample = await fixture.api.select<SampleRow>(
        "qr_batch_samples",
        `id=eq.${sampleId}&select=id,status,approved_by,invalidated_by,version`,
      );
      expect(batch[0].status).toBe("DRAFT");
      expect(sample[0]).toMatchObject({
        approved_by: fixture.actors.superAdmin.id,
        invalidated_by: fixture.actors.superAdmin.id,
        status: "INVALIDATED",
      });
      await expectAuditActors(
        sampleId,
        ["QR_BATCH_SAMPLE_ATTACHED", "QR_BATCH_SAMPLE_APPROVED", "QR_BATCH_SAMPLE_INVALIDATED"],
        [fixture.actors.superAdmin.id, fixture.actors.superAdmin.id, fixture.actors.superAdmin.id],
      );
      await expectAuditActors(batchId, ["QR_BATCH_REQUESTED"], [fixture.actors.siteAdmin.id]);
    });

    test("a new passing sample can enter requester final review after invalidation", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const batchCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByText("Waiting for sample", { exact: true }),
        })
        .first();
      await batchCard.getByText("Attach sample artifact", { exact: true }).first().click();
      const attachForm = batchCard.locator("form").filter({
        has: page.getByRole("button", { name: "Attach sample artifact" }),
      });
      await attachForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging replacement sample attachment");
      await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
      await expect(page).toHaveURL(/status=sampleGenerated/u);

      const approvalCard = page.locator(".admin-approval-card").filter({
        has: page.getByRole("button", { name: "Approve sample independently" }),
      });
      await approvalCard
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging replacement sample approval");
      await approvalCard.getByRole("button", { name: "Approve sample independently" }).click();
      await expect(page).toHaveURL(/status=sampleApproved/u);

      const samples = await fixture.api.select<SampleRow>(
        "qr_batch_samples",
        `batch_id=eq.${batchId}&select=id,status,approved_by,invalidated_by,version&order=created_at.asc`,
      );
      expect(samples).toHaveLength(2);
      expect(samples.map(({ status }) => status)).toEqual(["INVALIDATED", "APPROVED"]);
    });

    test("the original requester sends the Batch to final approval without starting generation", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.siteAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const batchCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByText("Sample approved", { exact: true }),
        })
        .first();
      await batchCard
        .locator("summary")
        .filter({ hasText: "Request final generation approval" })
        .click();
      const requestForm = batchCard.locator("form").filter({
        has: page.getByRole("button", { name: "Request final generation approval" }),
      });
      await requestForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging requester final review");
      await requestForm.getByRole("button", { name: "Request final generation approval" }).click();
      await expect(page).toHaveURL(/status=finalApprovalRequested/u);
      await expect(
        page.getByText(
          "The final generation approval request was added to the Super Admin review queue.",
          { exact: true },
        ),
      ).toBeVisible();

      const batches = await fixture.api.select<BatchRow>(
        "qr_batches",
        `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
      );
      expect(batches[0].status).toBe("FINAL_APPROVAL_PENDING");
      expect(
        await fixture.api.select<GenerationJobRow>(
          "qr_generation_jobs",
          `qr_batch_id=eq.${batchId}&select=id,qr_batch_id,approval_request_id,status,generation_revision,delivery_attempt_count,execution_attempt_count,queue_message_id`,
        ),
      ).toEqual([]);
    });

    test("an independent Super Admin records exactly one durable generation job", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const approvalCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({
          has: page.getByRole("button", { name: "Approve and prepare generation" }),
        })
        .first();
      await expect(approvalCard).toBeVisible();
      await approvalCard
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging independent final generation approval");
      await approvalCard.getByRole("button", { name: "Approve and prepare generation" }).click();
      await expect(page).toHaveURL(/status=finalGenerationApproved/u);
      await expect(
        page.getByText(
          "Final approval and a durable generation job were recorded. Queue delivery and QR generation have not started.",
          { exact: true },
        ),
      ).toBeVisible();

      const [batch] = await fixture.api.select<BatchRow>(
        "qr_batches",
        `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
      );
      const jobs = await fixture.api.select<GenerationJobRow>(
        "qr_generation_jobs",
        `qr_batch_id=eq.${batchId}&select=id,qr_batch_id,approval_request_id,status,generation_revision,delivery_attempt_count,execution_attempt_count,queue_message_id`,
      );
      expect(batch.status).toBe("GENERATION_APPROVED");
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        delivery_attempt_count: 0,
        execution_attempt_count: 0,
        generation_revision: 1,
        qr_batch_id: batchId,
        queue_message_id: null,
        status: "PENDING_DELIVERY",
      });
      await expectAuditActors(
        batchId,
        ["QR_BATCH_REQUESTED", "QR_BATCH_FINAL_APPROVAL_REQUESTED", "QR_BATCH_GENERATION_APPROVED"],
        [fixture.actors.siteAdmin.id, fixture.actors.siteAdmin.id, fixture.actors.superAdmin.id],
      );
    });

    test("the server-only dispatcher leases, retries, and records queue publication atomically", async () => {
      const pendingJobs = await fixture.api.select<GenerationJobRow>(
        "qr_generation_jobs",
        "status=eq.PENDING_DELIVERY&select=id,qr_batch_id,status,delivery_attempt_count,execution_attempt_count,queue_message_id",
      );
      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].qr_batch_id).toBe(batchId);

      const claimed = await fixture.api.rpc<{ jobs: GenerationClaim[] }>(
        "claim_pending_qr_generation_jobs",
        {
          p_lease_seconds: 30,
          p_limit: 1,
        },
      );
      expect(claimed.jobs).toHaveLength(1);
      expect(claimed.jobs[0]).toMatchObject({
        batchId,
        deliveryAttemptCount: 1,
        generationRevision: 1,
        jobId: pendingJobs[0].id,
        jobStatus: "DELIVERY_LEASED",
        jobType: "QR_GENERATION",
        siteId: fixture.sites.companyAFirst.id,
        tenantId: fixture.tenantAId,
      });
      expect(Object.keys(claimed.jobs[0]).sort()).toEqual(
        [
          "batchId",
          "createdAt",
          "deliveryAttemptCount",
          "generationRevision",
          "jobId",
          "jobStatus",
          "jobType",
          "jobVersion",
          "leaseExpiresAt",
          "siteId",
          "tenantId",
        ].sort(),
      );

      const retryAt = new Date(Date.now() + 5_000).toISOString();
      const failed = await fixture.api.rpc<GenerationDeliveryResult>(
        "record_qr_generation_delivery_failure",
        {
          p_available_at: retryAt,
          p_error_code: "QUEUE_UNAVAILABLE",
          p_expected_version: claimed.jobs[0].jobVersion,
          p_job_id: claimed.jobs[0].jobId,
        },
      );
      expect(failed).toMatchObject({
        batchId,
        batchStatus: "GENERATION_APPROVED",
        deliveryAttemptCount: 1,
        jobId: claimed.jobs[0].jobId,
        jobStatus: "RETRY_WAIT",
      });

      await expect
        .poll(
          async () =>
            (
              await fixture.api.rpc<{ jobs: GenerationClaim[] }>(
                "claim_pending_qr_generation_jobs",
                {
                  p_lease_seconds: 30,
                  p_limit: 1,
                },
              )
            ).jobs,
          { timeout: 10_000 },
        )
        .toHaveLength(1);

      const [reclaimedJob] = await fixture.api.select<GenerationJobRow>(
        "qr_generation_jobs",
        `id=eq.${claimed.jobs[0].jobId}&select=id,qr_batch_id,status,delivery_attempt_count,execution_attempt_count,queue_message_id,lease_expires_at,version`,
      );
      expect(reclaimedJob).toMatchObject({
        delivery_attempt_count: 2,
        execution_attempt_count: 0,
        queue_message_id: null,
        status: "DELIVERY_LEASED",
      });

      const published = await fixture.api.rpc<GenerationDeliveryResult>(
        "record_qr_generation_job_published",
        {
          p_expected_version: reclaimedJob.version,
          p_job_id: reclaimedJob.id,
          p_queue_message_id: `pgmq:qr-generation.${reclaimedJob.id}`,
        },
      );
      expect(published).toMatchObject({
        batchId,
        batchStatus: "GENERATION_QUEUED",
        deliveryAttemptCount: 2,
        jobId: reclaimedJob.id,
        jobStatus: "QUEUED",
      });
      expect(Object.keys(published).sort()).toEqual(
        [
          "batchId",
          "batchStatus",
          "batchVersion",
          "deliveryAttemptCount",
          "jobId",
          "jobStatus",
          "jobVersion",
        ].sort(),
      );

      const [[queuedBatch], [queuedJob]] = await Promise.all([
        fixture.api.select<BatchRow>(
          "qr_batches",
          `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
        ),
        fixture.api.select<GenerationJobRow>(
          "qr_generation_jobs",
          `id=eq.${reclaimedJob.id}&select=id,qr_batch_id,status,delivery_attempt_count,execution_attempt_count,queue_message_id,lease_expires_at,last_error_code,version`,
        ),
      ]);
      expect(queuedBatch.status).toBe("GENERATION_QUEUED");
      expect(queuedJob).toMatchObject({
        delivery_attempt_count: 2,
        execution_attempt_count: 0,
        last_error_code: null,
        lease_expires_at: null,
        queue_message_id: `pgmq:qr-generation.${reclaimedJob.id}`,
        status: "QUEUED",
      });
      generationJobId = queuedJob.id;
    });

    test("service runtime provisions a generated and delivered Batch without retaining fixture secrets", async () => {
      const generationRevision = 1;
      const generationContext = await fixture.api.rpc<{
        already_completed: boolean;
        requested_quantity: number;
      }>("start_qr_generation_execution", {
        p_generation_revision: generationRevision,
        p_job_id: generationJobId,
      });
      expect(generationContext).toMatchObject({
        already_completed: false,
        requested_quantity: 20,
      });

      const humanCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const generationItems = Array.from(
        { length: generationContext.requested_quantity },
        (_, index) => {
          const publicTokenMaterial = randomBytes(32);
          const humanCode = Array.from(
            randomBytes(10),
            (value) => humanCodeAlphabet[value % humanCodeAlphabet.length],
          ).join("");
          return {
            activation_code_ciphertext: `v1.${randomBytes(32).toString("base64url")}`,
            activation_code_hash: sha256(randomBytes(32)),
            activation_key_version: 1,
            decoded_public_token_hash: sha256(publicTokenMaterial),
            human_code: humanCode,
            internal_uuid: randomUUID(),
            ordinal: index + 1,
            preview_png_path: `staging-e2e/${batchId}/${index + 1}.png`,
            print_svg_path: `staging-e2e/${batchId}/${index + 1}.svg`,
            public_token_ciphertext: `v1.${randomBytes(32).toString("base64url")}`,
            public_token_hash: sha256(publicTokenMaterial),
            qr_asset_id: randomUUID(),
            render_checksum_sha256: sha256(`render:${batchId}:${index + 1}`),
            token_key_version: 1,
          };
        },
      );

      const chunk = await fixture.api.rpc<{
        committed_count: number;
        requested_count: number;
        total_count: number;
      }>("commit_qr_generation_chunk", {
        p_generation_revision: generationRevision,
        p_items: generationItems,
        p_job_id: generationJobId,
      });
      expect(chunk).toEqual({
        committed_count: 20,
        requested_count: 20,
        total_count: 20,
      });

      const completed = await fixture.api.rpc<{
        completed_count: number;
        status: string;
      }>("complete_qr_generation_execution", {
        p_generation_revision: generationRevision,
        p_job_id: generationJobId,
      });
      expect(completed).toMatchObject({ completed_count: 20, status: "COMPLETED" });

      const exportTypes = ["PDF", "CSV", "ZIP", "MANIFEST"] as const;
      const printExport = await fixture.api.rpc<{ export_count: number; status: string }>(
        "commit_qr_print_exports",
        {
          p_batch_id: batchId,
          p_export_revision: generationRevision,
          p_exports: exportTypes.map((exportType) => ({
            byte_size: 128,
            checksum_sha256: sha256(`export:${batchId}:${exportType}`),
            export_type: exportType,
            storage_path: `staging-e2e/${batchId}/bundle.${exportType.toLowerCase()}`,
          })),
        },
      );
      expect(printExport).toMatchObject({ export_count: 4, status: "PRINT_FILE_READY" });

      let [deliveryBatch] = await fixture.api.select<BatchRow>(
        "qr_batches",
        `id=eq.${batchId}&select=id,site_id,status,requested_by,version`,
      );
      for (const targetStatus of ["SENT_TO_PRINTER", "PRINTED", "SHIPPED", "DELIVERED"] as const) {
        const result = await fixture.api.rpc<{ status: string; version: number }>(
          "advance_qr_batch_delivery",
          {
            p_batch_id: batchId,
            p_expected_version: deliveryBatch.version,
            p_reason: `Authenticated staging ${targetStatus.toLowerCase()} transition`,
            p_request_id: randomUUID(),
            p_target_status: targetStatus,
          },
        );
        expect(result.status).toBe(targetStatus);
        deliveryBatch = { ...deliveryBatch, status: targetStatus, version: result.version };
      }

      phase4Assets = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `batch_id=eq.${batchId}&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version&order=human_code.asc`,
      );
      expect(deliveryBatch.status).toBe("DELIVERED");
      expect(phase4Assets).toHaveLength(20);
      expect(phase4Assets.every(({ status }) => status === "PRINTED")).toBe(true);
      expect(
        await fixture.api.select<{ id: string }>(
          "qr_activation_codes",
          `site_id=eq.${fixture.sites.companyAFirst.id}&select=id`,
        ),
      ).toHaveLength(20);
    });

    test("Site Admin receives every QR and rejects duplicate QR and vehicle Bindings", async ({
      page,
    }) => {
      const [manualAsset, duplicateAsset] = phase4Assets;
      const manualPlate = "12가3456";

      await signInAdmin(page, fixture.actors.siteAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const receiveCard = cardWithText(page, fixture.sites.companyAFirst.name)
        .filter({ has: page.getByRole("button", { name: "Receive Batch" }) })
        .first();
      await receiveCard
        .locator('input[name="reason"]')
        .fill("Authenticated staging complete Batch receipt");
      await receiveCard.getByRole("button", { name: "Receive Batch" }).click();
      await expect(page).toHaveURL(/status=batchReceived/u);

      phase4Assets = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `batch_id=eq.${batchId}&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version&order=human_code.asc`,
      );
      expect(phase4Assets.every(({ status }) => status === "IN_STOCK")).toBe(true);

      const manualForm = inventoryAssetForm(page, manualAsset.human_code, "Assign to vehicle");
      await manualForm.locator('input[name="vehiclePlate"]').fill(manualPlate);
      await manualForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging manual assignment");
      await manualForm.getByRole("button", { name: "Assign to vehicle" }).click();
      await expect(page).toHaveURL(/status=assetAssigned/u);

      const [assignedAsset] = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `id=eq.${manualAsset.id}&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version`,
      );
      expect(assignedAsset.status).toBe("ASSIGNED");

      const duplicateQrForm = inventoryAssetForm(
        page,
        duplicateAsset.human_code,
        "Assign to vehicle",
      );
      await duplicateQrForm.locator('input[name="qrAssetId"]').evaluate((input, value) => {
        (input as HTMLInputElement).value = value;
      }, manualAsset.id);
      await duplicateQrForm.locator('input[name="expectedVersion"]').evaluate((input, value) => {
        (input as HTMLInputElement).value = value;
      }, String(assignedAsset.version));
      await duplicateQrForm.locator('input[name="vehiclePlate"]').fill("34나5678");
      await duplicateQrForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging duplicate QR rejection");
      await duplicateQrForm.getByRole("button", { name: "Assign to vehicle" }).click();
      await expect(page).toHaveURL(/error=blocked/u);

      await page.goto("/en/admin/qr-inventory");
      const duplicateVehicleForm = inventoryAssetForm(
        page,
        duplicateAsset.human_code,
        "Assign to vehicle",
      );
      await duplicateVehicleForm.locator('input[name="vehiclePlate"]').fill(manualPlate);
      await duplicateVehicleForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging duplicate vehicle rejection");
      await duplicateVehicleForm.getByRole("button", { name: "Assign to vehicle" }).click();
      await expect(page).toHaveURL(/error=conflict/u);

      const bindings = await fixture.api.select<QrBindingRow>(
        "qr_bindings",
        `site_id=eq.${fixture.sites.companyAFirst.id}&select=id,qr_asset_id,vehicle_id,assignment_method,ended_at`,
      );
      expect(bindings).toHaveLength(1);
      expect(bindings[0]).toMatchObject({
        assignment_method: "MANUAL",
        ended_at: null,
        qr_asset_id: manualAsset.id,
      });
      const [stillStock] = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `id=eq.${duplicateAsset.id}&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version`,
      );
      expect(stillStock.status).toBe("IN_STOCK");
    });

    test("Site Admin validates and atomically commits one CSV assignment", async ({ page }) => {
      const csvAsset = phase4Assets[1];
      const csvPlate = "56다7890";
      const csvSource = `vehicle_plate,qr_human_code\n${csvPlate},${csvAsset.human_code}\n`;

      await signInAdmin(page, fixture.actors.siteAdmin, "ko");
      await page.goto("/ko/admin/qr-inventory");
      const importButton = page.getByRole("button", { name: "CSV 검증" });
      const importForm = importButton.locator("xpath=ancestor::form");
      await importForm
        .locator('select[name="siteScope"]')
        .selectOption(
          `${fixture.tenantAId}|${fixture.companyAId}|${fixture.sites.companyAFirst.id}`,
        );
      await importForm.locator('input[name="csvFile"]').setInputFiles({
        buffer: Buffer.from(csvSource, "utf8"),
        mimeType: "text/csv",
        name: "vehicle-assignment.csv",
      });
      await importForm.locator('input[name="reason"]').fill("Authenticated staging CSV validation");
      await importButton.click();
      await expect(page).toHaveURL(/status=importValidated/u);

      const [vehicleImport] = await fixture.api.select<VehicleImportRow>(
        "vehicle_imports",
        `site_id=eq.${fixture.sites.companyAFirst.id}&select=id,status,row_count,source_checksum_sha256,original_deleted_at,committed_at,version`,
      );
      vehicleImportId = vehicleImport.id;
      expect(vehicleImport).toMatchObject({
        committed_at: null,
        row_count: 1,
        source_checksum_sha256: sha256(csvSource),
        status: "VALIDATED",
      });
      expect(Date.parse(vehicleImport.original_deleted_at)).not.toBeNaN();

      const [protectedRow] = await fixture.api.select<{
        plate_ciphertext: string;
        plate_last4: string;
        qr_asset_id: string;
      }>(
        "vehicle_import_rows",
        `import_id=eq.${vehicleImportId}&select=plate_ciphertext,plate_last4,qr_asset_id`,
      );
      expect(protectedRow).toMatchObject({
        plate_last4: "7890",
        qr_asset_id: csvAsset.id,
      });
      expect(protectedRow.plate_ciphertext).not.toContain(csvPlate);

      const commitButton = page.getByRole("button", { name: "검증 결과 배정 확정" });
      const commitForm = commitButton.locator("xpath=ancestor::form");
      await commitForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging atomic CSV commit");
      await commitButton.click();
      await expect(page).toHaveURL(/status=importCommitted/u);

      const [committedImport] = await fixture.api.select<VehicleImportRow>(
        "vehicle_imports",
        `id=eq.${vehicleImportId}&select=id,status,row_count,source_checksum_sha256,original_deleted_at,committed_at,version`,
      );
      const [assignedAsset] = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `id=eq.${csvAsset.id}&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version`,
      );
      expect(committedImport.status).toBe("COMMITTED");
      expect(committedImport.committed_at).not.toBeNull();
      expect(assignedAsset.status).toBe("ASSIGNED");
    });

    test("Super Admin replaces then finally revokes QR while preserving all histories", async ({
      page,
    }) => {
      const [manualAsset, csvAsset, replacementAsset] = phase4Assets;

      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const replacementForm = inventoryAssetForm(
        page,
        manualAsset.human_code,
        "Transfer Binding to replacement",
      ).locator("form", {
        has: page.getByRole("button", { name: "Transfer Binding to replacement" }),
      });
      await replacementForm
        .locator('select[name="replacementScope"]')
        .selectOption({ label: replacementAsset.human_code });
      await replacementForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging Binding replacement");
      await replacementForm
        .getByRole("button", { name: "Transfer Binding to replacement" })
        .click();
      await expect(page).toHaveURL(/status=assetReplaced/u);

      const revokeForm = inventoryAssetForm(page, replacementAsset.human_code, "Revoke QR").locator(
        "form",
        { has: page.getByRole("button", { name: "Revoke QR" }) },
      );
      await revokeForm
        .locator('input[name="reason"]')
        .fill("Authenticated staging replacement revocation");
      await revokeForm.getByRole("button", { name: "Revoke QR" }).click();
      await expect(page).toHaveURL(/status=assetRevoked/u);

      const assets = await fixture.api.select<QrAssetRow>(
        "qr_assets",
        `id=in.(${manualAsset.id},${csvAsset.id},${replacementAsset.id})&select=id,batch_id,human_code,status,current_vehicle_id,current_binding_id,version`,
      );
      expect(Object.fromEntries(assets.map((asset) => [asset.id, asset.status]))).toEqual({
        [csvAsset.id]: "ASSIGNED",
        [manualAsset.id]: "REPLACED",
        [replacementAsset.id]: "REVOKED",
      });

      const bindings = await fixture.api.select<QrBindingRow>(
        "qr_bindings",
        `qr_asset_id=in.(${manualAsset.id},${csvAsset.id},${replacementAsset.id})&select=id,qr_asset_id,vehicle_id,assignment_method,ended_at&order=created_at.asc`,
      );
      expect(bindings).toHaveLength(3);
      const manualBinding = bindings.find(({ qr_asset_id }) => qr_asset_id === manualAsset.id);
      const csvBinding = bindings.find(({ qr_asset_id }) => qr_asset_id === csvAsset.id);
      const replacementBinding = bindings.find(
        ({ qr_asset_id }) => qr_asset_id === replacementAsset.id,
      );
      expect(manualBinding).toMatchObject({ assignment_method: "MANUAL" });
      expect(manualBinding?.ended_at).not.toBeNull();
      expect(csvBinding).toMatchObject({ assignment_method: "CSV_IMPORT", ended_at: null });
      expect(replacementBinding).toMatchObject({ assignment_method: "REPLACEMENT" });
      expect(replacementBinding?.ended_at).not.toBeNull();
      expect(replacementBinding?.vehicle_id).toBe(manualBinding?.vehicle_id);

      const transactions = await fixture.api.select<InventoryTransactionRow>(
        "inventory_transactions",
        `qr_batch_id=eq.${batchId}&select=transaction_type,quantity,qr_asset_id&order=created_at.asc`,
      );
      expect(transactions.map(({ transaction_type }) => transaction_type)).toEqual([
        "RECEIVE",
        "ASSIGN",
        "ASSIGN",
        "REPLACE",
        "REVOKE",
      ]);
      expect(transactions[0]).toMatchObject({ qr_asset_id: null, quantity: 20 });

      const statusHistory = await fixture.api.select<{
        qr_asset_id: string;
        reason_code: string;
      }>(
        "qr_asset_status_logs",
        `qr_asset_id=in.(${manualAsset.id},${csvAsset.id},${replacementAsset.id})&select=qr_asset_id,reason_code&order=created_at.asc`,
      );
      const reasonsByAsset = Object.groupBy(statusHistory, ({ qr_asset_id }) => qr_asset_id);
      expect(reasonsByAsset[manualAsset.id]?.map(({ reason_code }) => reason_code)).toEqual(
        expect.arrayContaining([
          "QR_GENERATED",
          "RENDER_QUALITY_PASSED",
          "PRINT_CONFIRMED",
          "BATCH_RECEIVED",
          "MANUAL_ASSIGNMENT",
          "QR_REPLACED",
        ]),
      );
      expect(reasonsByAsset[csvAsset.id]?.map(({ reason_code }) => reason_code)).toEqual(
        expect.arrayContaining(["BATCH_RECEIVED", "CSV_IMPORT_ASSIGNMENT"]),
      );
      expect(reasonsByAsset[replacementAsset.id]?.map(({ reason_code }) => reason_code)).toEqual(
        expect.arrayContaining(["BATCH_RECEIVED", "QR_REPLACEMENT_ASSIGNED", "ADMIN_REVOKE"]),
      );

      const phase4Actions = [
        "QR_BATCH_RECEIVED",
        "QR_ASSET_ASSIGNED",
        "VEHICLE_IMPORT_VALIDATED",
        "VEHICLE_IMPORT_COMMITTED",
        "QR_ASSET_REPLACED",
        "QR_ASSET_REVOKED",
      ];
      const audits = await fixture.api.select<AuditRow>(
        "audit_logs",
        `site_id=eq.${fixture.sites.companyAFirst.id}&action=in.(${phase4Actions.join(",")})&select=action,actor_id,before_data,after_data&order=created_at.asc`,
      );
      expect(audits.map(({ action }) => action)).toEqual(phase4Actions);
      expect(audits.map(({ actor_id }) => actor_id)).toEqual([
        fixture.actors.siteAdmin.id,
        fixture.actors.siteAdmin.id,
        fixture.actors.siteAdmin.id,
        fixture.actors.siteAdmin.id,
        fixture.actors.superAdmin.id,
        fixture.actors.superAdmin.id,
      ]);
      expect(audits.every((row) => auditPayloadIsSafe([row.before_data, row.after_data]))).toBe(
        true,
      );
      expect(JSON.stringify(audits)).not.toMatch(/12가3456|56다7890/u);
    });

    test("concurrent requester cancellation and Super Admin approval commit exactly one outcome", async ({
      browser,
      page,
    }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL;
      if (typeof baseURL !== "string") {
        throw new Error("Staging race E2E requires the configured base URL.");
      }

      await signInAdmin(page, fixture.actors.siteAdmin, "en");
      await page.goto("/en/admin/qr-inventory");
      const batchRequestButton = page.getByRole("button", { name: "Request small Batch" });
      const batchRequestForm = batchRequestButton.locator("xpath=ancestor::form");
      await batchRequestForm.locator('input[name="quantity"]').fill("12");
      await batchRequestForm.locator('input[name="purpose"]').fill("Final approval race evidence");
      await batchRequestForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging race Batch request");
      await batchRequestButton.click();
      await expect(page).toHaveURL(/status=batchRequested/u);

      const [raceBatch] = await fixture.api.select<RaceBatchRow>(
        "qr_batches",
        `site_id=eq.${fixture.sites.companyAFirst.id}&status=eq.DRAFT&select=id,batch_code,site_id,status,requested_by,version&order=created_at.desc&limit=1`,
      );
      expect(raceBatch.requested_by).toBe(fixture.actors.siteAdmin.id);

      const superContext = await browser.newContext({ baseURL });
      const superPage = await superContext.newPage();
      try {
        await signInAdmin(superPage, fixture.actors.superAdmin, "en");
        await superPage.goto("/en/admin/qr-inventory");
        const draftCard = cardWithText(superPage, raceBatch.batch_code)
          .filter({
            has: superPage.getByText("Waiting for sample", { exact: true }),
          })
          .first();
        await draftCard.locator("summary").filter({ hasText: "Attach sample artifact" }).click();
        const attachForm = draftCard.locator("form").filter({
          has: superPage.getByRole("button", { name: "Attach sample artifact" }),
        });
        await attachForm
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging race sample attachment");
        await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
        await expect(superPage).toHaveURL(/status=sampleGenerated/u);

        const sampleApprovalCard = cardWithText(superPage, raceBatch.batch_code)
          .filter({
            has: superPage.getByRole("button", { name: "Approve sample independently" }),
          })
          .first();
        await sampleApprovalCard
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging race sample approval");
        await sampleApprovalCard
          .getByRole("button", { name: "Approve sample independently" })
          .click();
        await expect(superPage).toHaveURL(/status=sampleApproved/u);

        await page.goto("/en/admin/qr-inventory");
        const finalRequestCard = cardWithText(page, raceBatch.batch_code).first();
        await finalRequestCard
          .locator("summary")
          .filter({ hasText: "Request final generation approval" })
          .click();
        const finalRequestForm = finalRequestCard.locator("form").filter({
          has: page.getByRole("button", { name: "Request final generation approval" }),
        });
        await finalRequestForm
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging race final review request");
        await finalRequestForm
          .getByRole("button", { name: "Request final generation approval" })
          .click();
        await expect(page).toHaveURL(/status=finalApprovalRequested/u);

        await Promise.all([
          page.goto("/en/admin/qr-inventory"),
          superPage.goto("/en/admin/qr-inventory"),
        ]);
        const cancellationCard = cardWithText(page, raceBatch.batch_code).first();
        await cancellationCard
          .locator("summary")
          .filter({ hasText: "Cancel Batch request" })
          .click();
        const cancellationForm = cancellationCard.locator("form").filter({
          has: page.getByRole("button", { name: "Cancel Batch request" }),
        });
        await cancellationForm
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging concurrent cancellation");

        const generationApprovalCard = cardWithText(superPage, raceBatch.batch_code)
          .filter({
            has: superPage.getByRole("button", { name: "Approve and prepare generation" }),
          })
          .first();
        await generationApprovalCard
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging concurrent generation approval");

        await Promise.all([
          cancellationForm.getByRole("button", { name: "Cancel Batch request" }).click(),
          generationApprovalCard
            .getByRole("button", { name: "Approve and prepare generation" })
            .click(),
        ]);
        await expect
          .poll(
            () => {
              const cancellationSettled = /(?:status=finalApprovalCancelled|error=conflict)/u.test(
                page.url(),
              );
              const approvalSettled = /(?:status=finalGenerationApproved|error=conflict)/u.test(
                superPage.url(),
              );
              return cancellationSettled && approvalSettled
                ? "settled"
                : `cancellation=${page.url()} approval=${superPage.url()}`;
            },
            {
              message: "both concurrent actions should redirect to a committed or conflict outcome",
              timeout: 30_000,
            },
          )
          .toBe("settled");

        const [committedBatch] = await fixture.api.select<BatchRow>(
          "qr_batches",
          `id=eq.${raceBatch.id}&select=id,site_id,status,requested_by,version`,
        );
        const jobs = await fixture.api.select<GenerationJobRow>(
          "qr_generation_jobs",
          `qr_batch_id=eq.${raceBatch.id}&select=id,qr_batch_id,approval_request_id,status,generation_revision,delivery_attempt_count,execution_attempt_count,queue_message_id`,
        );

        if (committedBatch.status === "CANCELLED") {
          await expect(page).toHaveURL(/status=finalApprovalCancelled/u);
          await expect(superPage).toHaveURL(/error=conflict/u);
          expect(jobs).toEqual([]);
          await expectAuditActors(
            raceBatch.id,
            [
              "QR_BATCH_REQUESTED",
              "QR_BATCH_FINAL_APPROVAL_REQUESTED",
              "QR_BATCH_CANCELLED_BEFORE_GENERATION",
            ],
            [fixture.actors.siteAdmin.id, fixture.actors.siteAdmin.id, fixture.actors.siteAdmin.id],
          );
        } else {
          expect(committedBatch.status).toBe("GENERATION_APPROVED");
          await expect(superPage).toHaveURL(/status=finalGenerationApproved/u);
          await expect(page).toHaveURL(/error=conflict/u);
          expect(jobs).toHaveLength(1);
          expect(jobs[0]).toMatchObject({
            generation_revision: 1,
            qr_batch_id: raceBatch.id,
            status: "PENDING_DELIVERY",
          });
          await expectAuditActors(
            raceBatch.id,
            [
              "QR_BATCH_REQUESTED",
              "QR_BATCH_FINAL_APPROVAL_REQUESTED",
              "QR_BATCH_GENERATION_APPROVED",
            ],
            [
              fixture.actors.siteAdmin.id,
              fixture.actors.siteAdmin.id,
              fixture.actors.superAdmin.id,
            ],
          );
        }
      } finally {
        await superContext.close();
      }
    });

    test("staging cleanup leaves QR, customer, admin, and Auth residue at zero", async () => {
      const siteIds = [
        fixture.sites.companyAFirst.id,
        fixture.sites.companyASecond.id,
        fixture.sites.tenantB.id,
      ];
      const actorIds = Object.values(fixture.actors).map(({ id }) => id);
      await fixture.cleanup();

      await expectNoRows("vehicle_import_rows", siteIds);
      await expectNoRows("vehicle_imports", siteIds);
      await expectNoRows("inventory_transactions", siteIds);
      await expectNoRows("qr_bindings", siteIds);
      await expectNoRows("vehicles", siteIds);
      await expectNoRows("qr_activation_codes", siteIds);
      await expectNoRows("qr_generation_items", siteIds);
      await expectNoRows("rendered_assets", siteIds);
      await expectNoRows("print_exports", siteIds);
      await expectNoRows("qr_asset_status_logs", siteIds);
      await expectNoRows("qr_generation_jobs", siteIds);
      await expectNoRows("qr_batch_samples", siteIds);
      await expectNoRows("qr_assets", siteIds);
      await expectNoRows("qr_batches", siteIds);
      await expectNoRows("sticker_design_versions", siteIds);
      await expectNoRows("audit_logs", siteIds);
      await expectNoRows("site_lifecycle_requests", siteIds);
      expect(
        await fixture.api.select<{ id: string }>("sites", `id=in.(${siteIds.join(",")})&select=id`),
      ).toEqual([]);
      expect(
        await fixture.api.select<{ id: string }>(
          "management_companies",
          `id=in.(${fixture.companyAId},${fixture.companyBId})&select=id`,
        ),
      ).toEqual([]);
      expect(
        await fixture.api.select<{ id: string }>(
          "tenants",
          `id=in.(${fixture.tenantAId},${fixture.tenantBId})&select=id`,
        ),
      ).toEqual([]);
      expect(
        await fixture.api.select<{ user_id: string }>(
          "admin_profiles",
          `user_id=in.(${actorIds.join(",")})&select=user_id`,
        ),
      ).toEqual([]);
      await expect
        .poll(async () => Promise.all(actorIds.map((id) => fixture.api.authUserExists(id))))
        .toEqual([false, false, false]);
    });
  });
