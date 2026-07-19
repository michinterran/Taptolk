import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  auditPayloadIsSafe,
  createStagingFixture,
  currentTotp,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

interface AuditRow {
  action: string;
  actor_id: string | null;
  after_data: unknown;
  before_data: unknown;
}

let fixture: StagingFixture;

async function signInAndEnrollMfa(page: Page, actor: StagingActor, locale: "en" | "ko") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin/mfa/enroll$`, "u"));

  await page.locator(".admin-enrollment-start button").click();
  const secret = await page.locator(".admin-enrollment-secret code").textContent();
  if (!secret) {
    throw new Error("The real MFA enrollment UI returned no TOTP secret.");
  }
  await page.locator('input[name="code"]').fill(await currentTotp(secret));
  await page.locator(".admin-mfa-form button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin/(platform|dashboard)$`, "u"));
}

function siteRow(page: Page, siteName: string): Locator {
  return page.getByRole("row").filter({ hasText: siteName });
}

async function openSiteActions(page: Page, siteName: string): Promise<Locator> {
  const row = siteRow(page, siteName);
  const summary = row.locator("details > summary");
  await expect(row).toBeVisible();
  await expect(summary).toHaveCount(1);
  await summary.click();
  return row;
}

async function updateOperational(
  page: Page,
  currentName: string,
  nextName: string,
  address: string,
  saveButtonName: string,
) {
  const row = await openSiteActions(page, currentName);
  const form = row.locator("form").first();
  await form.locator('input[name="name"]').fill(nextName);
  await form.locator('input[name="address"]').fill(address);
  await form
    .locator('textarea[name="reason"]')
    .fill("Authenticated staging E2E operational update");
  await form.getByRole("button", { name: saveButtonName }).click();
  await expect(page).toHaveURL(/status=operationalUpdated/u);
  await expect(siteRow(page, nextName)).toBeVisible();
}

async function submitTamperedOperationalUpdate(
  page: Page,
  visibleSiteName: string,
  target: {
    companyId: string;
    expectedVersion: number;
    siteId: string;
    tenantId: string;
  },
  saveButtonName: string,
) {
  const row = await openSiteActions(page, visibleSiteName);
  const form = row.locator("form").first();
  const hiddenValues: Readonly<Record<string, string>> = {
    expectedVersion: String(target.expectedVersion),
    managementCompanyId: target.companyId,
    siteId: target.siteId,
    tenantId: target.tenantId,
  };
  for (const [name, value] of Object.entries(hiddenValues)) {
    await form.locator(`input[name="${name}"]`).evaluate((element, nextValue) => {
      (element as HTMLInputElement).value = nextValue;
    }, value);
  }
  await form.locator('input[name="name"]').fill(`${fixture.runLabel} forbidden mutation`);
  await form.locator('textarea[name="reason"]').fill("Authenticated staging E2E scope denial");
  await form.getByRole("button", { name: saveButtonName }).click();
  await expect(page).toHaveURL(/error=forbidden/u);
}

async function expectAudit(
  siteId: string,
  actorId: string,
  expectedActions: readonly string[],
  forbiddenAddress: string,
) {
  const rows = await fixture.api.select<AuditRow>(
    "audit_logs",
    `resource_id=eq.${encodeURIComponent(siteId)}&select=action,actor_id,before_data,after_data&order=created_at.asc`,
  );
  expect(rows.map(({ action }) => action)).toEqual(expectedActions);
  expect(rows.every(({ actor_id: auditActorId }) => auditActorId === actorId)).toBe(true);
  expect(
    rows.every(({ before_data, after_data }) => auditPayloadIsSafe([before_data, after_data])),
  ).toBe(true);
  expect(JSON.stringify(rows)).not.toContain(forbiddenAddress);
}

test.describe
  .serial("authenticated staging Site CRUD and tenant isolation", () => {
    test.beforeAll(async () => {
      fixture = await createStagingFixture();
    });

    test.afterAll(async () => {
      await fixture?.cleanup();
    });

    test("Super Admin completes the full lifecycle through the real KO and EN UI", async ({
      page,
    }) => {
      await signInAndEnrollMfa(page, fixture.actors.superAdmin, "ko");
      await page.goto("/ko/admin/sites");
      await expect(siteRow(page, fixture.sites.companyAFirst.name)).toBeVisible();
      await expect(siteRow(page, fixture.sites.companyASecond.name)).toBeVisible();
      await expect(siteRow(page, fixture.sites.tenantB.name)).toBeVisible();

      await page.getByText("새 사이트 직접 등록", { exact: true }).click();
      await page
        .locator('select[name="parentScope"]')
        .selectOption(`${fixture.tenantAId}|${fixture.companyAId}`);
      await page.locator('input[name="name"]').first().fill(fixture.lifecycleSiteName);
      await page.locator('select[name="siteType"]').first().selectOption("BUILDING");
      await page.locator('input[name="timezone"]').first().fill("Asia/Seoul");
      await page.locator('input[name="contractVehicleLimit"]').first().fill("120");
      const lifecycleAddress = `${fixture.runLabel} lifecycle private address`;
      await page.locator('input[name="address"]').first().fill(lifecycleAddress);
      await page
        .locator('textarea[name="reason"]')
        .first()
        .fill("Authenticated staging E2E Site creation");
      await page.getByRole("button", { name: "사이트 등록" }).click();
      await expect(page).toHaveURL(/status=created/u);
      await expect(siteRow(page, fixture.lifecycleSiteName)).toBeVisible();

      const createdRows = await fixture.api.select<{ id: string }>(
        "sites",
        `name=eq.${encodeURIComponent(fixture.lifecycleSiteName)}&select=id`,
      );
      expect(createdRows).toHaveLength(1);
      const lifecycleSiteId = createdRows[0].id;
      fixture.createdSiteIds.add(lifecycleSiteId);

      await page.getByRole("link", { name: "영어로 보기" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/sites$/u);
      const updatedName = `${fixture.lifecycleSiteName} Updated`;
      await updateOperational(
        page,
        fixture.lifecycleSiteName,
        updatedName,
        `${fixture.runLabel} updated private address`,
        "Save operations",
      );

      let row = await openSiteActions(page, updatedName);
      const contractForm = row.locator("form").nth(1);
      await contractForm.locator('input[name="contractVehicleLimit"]').fill("240");
      await contractForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging E2E contract update");
      await contractForm.getByRole("button", { name: "Save contract limit" }).click();
      await expect(page).toHaveURL(/status=contractUpdated/u);
      expect((await fixture.api.site(lifecycleSiteId)).contract_vehicle_limit).toBe(240);

      row = await openSiteActions(page, updatedName);
      let statusForm = row.locator("form").last();
      await statusForm.locator('textarea[name="reason"]').fill("Authenticated staging E2E suspend");
      await statusForm.getByRole("button", { name: "Suspend" }).click();
      await expect(page).toHaveURL(/status=statusChanged/u);
      await expect
        .poll(async () => (await fixture.api.site(lifecycleSiteId)).status)
        .toBe("SUSPENDED");
      await page.reload();

      row = await openSiteActions(page, updatedName);
      statusForm = row.locator("form").last();
      await statusForm
        .locator('textarea[name="reason"]')
        .fill("Authenticated staging E2E reactivate");
      await statusForm.getByRole("button", { name: "Reactivate" }).click();
      await expect
        .poll(async () => (await fixture.api.site(lifecycleSiteId)).status)
        .toBe("ACTIVE");
      await page.reload();

      row = await openSiteActions(page, updatedName);
      statusForm = row.locator("form").last();
      await statusForm.locator('textarea[name="reason"]').fill("Authenticated staging E2E close");
      await statusForm.getByRole("button", { name: "Close operations" }).click();
      await expect
        .poll(async () => (await fixture.api.site(lifecycleSiteId)).status)
        .toBe("CLOSED");

      await expectAudit(
        lifecycleSiteId,
        fixture.actors.superAdmin.id,
        [
          "SITE_CREATED",
          "SITE_OPERATIONAL_UPDATED",
          "SITE_CONTRACT_LIMIT_UPDATED",
          "SITE_SUSPENDED",
          "SITE_REACTIVATED",
          "SITE_CLOSED",
        ],
        lifecycleAddress,
      );
    });

    test("Management Admin sees and mutates only its management-company scope", async ({
      page,
    }) => {
      await signInAndEnrollMfa(page, fixture.actors.managementAdmin, "ko");
      await page.goto("/ko/admin/sites");
      await expect(siteRow(page, fixture.sites.companyAFirst.name)).toBeVisible();
      await expect(siteRow(page, fixture.sites.companyASecond.name)).toBeVisible();
      await expect(page.getByText(fixture.sites.tenantB.name, { exact: true })).toHaveCount(0);
      await expect(
        page.getByText(
          "이 역할은 사이트 상태 변경을 직접 실행하지 않습니다. 요청·승인 큐가 연결되기 전까지 현재 상태를 유지합니다.",
        ),
      ).toBeVisible();

      const updatedName = `${fixture.sites.companyASecond.name} Managed`;
      await updateOperational(
        page,
        fixture.sites.companyASecond.name,
        updatedName,
        `${fixture.runLabel} management update`,
        "운영정보 저장",
      );
      const foreignBefore = await fixture.api.site(fixture.sites.tenantB.id);
      await submitTamperedOperationalUpdate(
        page,
        updatedName,
        {
          companyId: fixture.companyBId,
          expectedVersion: foreignBefore.version,
          siteId: fixture.sites.tenantB.id,
          tenantId: fixture.tenantBId,
        },
        "운영정보 저장",
      );
      expect(await fixture.api.site(fixture.sites.tenantB.id)).toEqual(foreignBefore);
      await expectAudit(
        fixture.sites.companyASecond.id,
        fixture.actors.managementAdmin.id,
        ["SITE_OPERATIONAL_UPDATED"],
        fixture.sites.companyASecond.address,
      );
    });

    test("Site Admin sees and mutates only its exact Site scope", async ({ page }) => {
      await signInAndEnrollMfa(page, fixture.actors.siteAdmin, "en");
      await page.goto("/en/admin/sites");
      await expect(siteRow(page, fixture.sites.companyAFirst.name)).toBeVisible();
      await expect(
        page.getByText(`${fixture.sites.companyASecond.name} Managed`, { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText(fixture.sites.tenantB.name, { exact: true })).toHaveCount(0);

      const updatedName = `${fixture.sites.companyAFirst.name} Admin`;
      await updateOperational(
        page,
        fixture.sites.companyAFirst.name,
        updatedName,
        `${fixture.runLabel} site admin update`,
        "Save operations",
      );
      const siblingBefore = await fixture.api.site(fixture.sites.companyASecond.id);
      await submitTamperedOperationalUpdate(
        page,
        updatedName,
        {
          companyId: fixture.companyAId,
          expectedVersion: siblingBefore.version,
          siteId: fixture.sites.companyASecond.id,
          tenantId: fixture.tenantAId,
        },
        "Save operations",
      );
      expect(await fixture.api.site(fixture.sites.companyASecond.id)).toEqual(siblingBefore);
      await expectAudit(
        fixture.sites.companyAFirst.id,
        fixture.actors.siteAdmin.id,
        ["SITE_OPERATIONAL_UPDATED"],
        fixture.sites.companyAFirst.address,
      );
    });
  });
