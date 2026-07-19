import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  auditPayloadIsSafe,
  createStagingFixture,
  currentTotp,
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
    | "DRAFT"
    | "FINAL_APPROVAL_PENDING"
    | "GENERATION_APPROVED"
    | "GENERATION_QUEUED"
    | "SAMPLE_APPROVED"
    | "SAMPLE_READY";
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
const mfaSecrets = new Map<string, string>();
let designId = "";
let batchId = "";
let sampleId = "";

async function signInAndSatisfyMfa(page: Page, actor: StagingActor, locale: "en" | "ko") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.locator('button[type="submit"]').first().click();
  const existingSecret = mfaSecrets.get(actor.id);
  if (existingSecret) {
    await expect(page).toHaveURL(new RegExp(`/${locale}/admin/mfa/challenge$`, "u"), {
      timeout: 15_000,
    });
    await page.locator('input[name="code"]').fill(await currentTotp(existingSecret));
    await page.locator(".admin-mfa-form button[type='submit']").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/admin/(platform|dashboard)$`, "u"));
    return;
  }

  await expect(page).toHaveURL(new RegExp(`/${locale}/admin/mfa/enroll$`, "u"), {
    timeout: 15_000,
  });
  await page.locator(".admin-enrollment-start button").click();
  const secret = await page.locator(".admin-enrollment-secret code").textContent();
  if (!secret) {
    throw new Error("The real MFA enrollment UI returned no TOTP secret.");
  }
  mfaSecrets.set(actor.id, secret);
  await page.locator('input[name="code"]').fill(await currentTotp(secret));
  await page.locator(".admin-mfa-form button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin/(platform|dashboard)$`, "u"));
}

function cardWithText(page: Page, text: string): Locator {
  return page.locator(".admin-approval-card").filter({ hasText: text });
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
      await signInAndSatisfyMfa(page, fixture.actors.managementAdmin, "ko");
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
      await createForm.locator('input[name="templateCode"]').fill("ROUND_85");
      await createForm
        .locator('textarea[name="designConfig"]')
        .fill('{"layout":"round-85","qrQuietZone":4}');
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
      await validForm.locator('input[name="templateCode"]').fill("ROUND_85");
      await validForm
        .locator('textarea[name="designConfig"]')
        .fill('{"layout":"round-85","qrQuietZone":4}');
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
      await signInAndSatisfyMfa(page, fixture.actors.superAdmin, "en");
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
      await signInAndSatisfyMfa(page, fixture.actors.siteAdmin, "en");
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
      await signInAndSatisfyMfa(page, fixture.actors.superAdmin, "en");
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
      await attachForm.locator('input[name="storageBucket"]').fill("qr-samples");
      await attachForm
        .locator('input[name="storagePath"]')
        .fill(`${fixture.tenantAId}/${fixture.sites.companyAFirst.id}/sample.png`);
      await attachForm.locator('input[name="checksumSha256"]').fill("a".repeat(64));
      await attachForm.locator('input[name="byteSize"]').fill("2048");
      await attachForm.locator('input[name="decodePassed"]').check();
      await attachForm.locator('input[name="quietZonePassed"]').check();
      await attachForm.locator('input[name="contrastPassed"]').check();
      await attachForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging sample attachment");
      await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
      await expect(page).toHaveURL(/status=sampleAttached/u);

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
      await signInAndSatisfyMfa(page, fixture.actors.superAdmin, "ko");
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
      await signInAndSatisfyMfa(page, fixture.actors.superAdmin, "en");
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
      await attachForm.locator('input[name="storageBucket"]').fill("qr-samples");
      await attachForm
        .locator('input[name="storagePath"]')
        .fill(`${fixture.tenantAId}/${fixture.sites.companyAFirst.id}/sample-v2.png`);
      await attachForm.locator('input[name="checksumSha256"]').fill("b".repeat(64));
      await attachForm.locator('input[name="byteSize"]').fill("4096");
      await attachForm.locator('input[name="decodePassed"]').check();
      await attachForm.locator('input[name="quietZonePassed"]').check();
      await attachForm.locator('input[name="contrastPassed"]').check();
      await attachForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging replacement sample attachment");
      await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
      await expect(page).toHaveURL(/status=sampleAttached/u);

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
      await signInAndSatisfyMfa(page, fixture.actors.siteAdmin, "en");
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
      await signInAndSatisfyMfa(page, fixture.actors.superAdmin, "en");
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

      const retryAt = new Date(Date.now() + 1_000).toISOString();
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
          { timeout: 5_000 },
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
    });

    test("concurrent requester cancellation and Super Admin approval commit exactly one outcome", async ({
      browser,
      page,
    }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL;
      if (typeof baseURL !== "string") {
        throw new Error("Staging race E2E requires the configured base URL.");
      }

      await signInAndSatisfyMfa(page, fixture.actors.siteAdmin, "en");
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
        await signInAndSatisfyMfa(superPage, fixture.actors.superAdmin, "en");
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
        await attachForm.locator('input[name="storageBucket"]').fill("qr-samples");
        await attachForm
          .locator('input[name="storagePath"]')
          .fill(`${fixture.tenantAId}/${fixture.sites.companyAFirst.id}/race-sample.png`);
        await attachForm.locator('input[name="checksumSha256"]').fill("c".repeat(64));
        await attachForm.locator('input[name="byteSize"]').fill("3072");
        await attachForm.locator('input[name="decodePassed"]').check();
        await attachForm.locator('input[name="quietZonePassed"]').check();
        await attachForm.locator('input[name="contrastPassed"]').check();
        await attachForm
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging race sample attachment");
        await attachForm.getByRole("button", { name: "Attach sample artifact" }).click();
        await expect(superPage).toHaveURL(/status=sampleAttached/u);

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

        const cancellationOutcome = page.waitForURL(
          /(?:status=finalApprovalCancelled|error=conflict)/u,
          { timeout: 15_000 },
        );
        const approvalOutcome = superPage.waitForURL(
          /(?:status=finalGenerationApproved|error=conflict)/u,
          { timeout: 15_000 },
        );
        await Promise.all([
          cancellationForm.getByRole("button", { name: "Cancel Batch request" }).click(),
          generationApprovalCard
            .getByRole("button", { name: "Approve and prepare generation" })
            .click(),
        ]);
        await Promise.all([cancellationOutcome, approvalOutcome]);

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

      await expectNoRows("qr_generation_jobs", siteIds);
      await expectNoRows("qr_batch_samples", siteIds);
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
