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
  status: "CANCELLED" | "DRAFT" | "SAMPLE_APPROVED" | "SAMPLE_READY";
  version: number;
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
          "샘플 승인은 대량 생성을 시작하지 않습니다. 대량 생성은 후속 Super Admin 최종 승인과 Queue/Worker가 연결된 뒤에만 가능합니다.",
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

    test("staging cleanup leaves QR, customer, admin, and Auth residue at zero", async () => {
      const siteIds = [
        fixture.sites.companyAFirst.id,
        fixture.sites.companyASecond.id,
        fixture.sites.tenantB.id,
      ];
      const actorIds = Object.values(fixture.actors).map(({ id }) => id);
      await fixture.cleanup();

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
