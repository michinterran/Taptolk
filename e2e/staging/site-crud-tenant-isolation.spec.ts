import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  auditPayloadIsSafe,
  createStagingFixture,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

interface AuditRow {
  action: string;
  actor_id: string | null;
  after_data: unknown;
  before_data: unknown;
}

interface LifecycleRequestRow {
  action: "CLOSE" | "REACTIVATE" | "SUSPEND";
  id: string;
  requested_by: string;
  reviewed_by: string | null;
  site_id: string;
  status: "APPROVED" | "CANCELLED" | "PENDING" | "REJECTED";
}

let fixture: StagingFixture;

async function signInAdmin(page: Page, actor: StagingActor, locale: "en" | "ko") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin(?:/(?:platform|dashboard))?$`, "u"));
}

function siteRow(page: Page, siteName: string): Locator {
  return page.getByRole("row").filter({ hasText: siteName });
}

async function openSiteActions(page: Page, siteName: string): Promise<Locator> {
  const row = siteRow(page, siteName);
  const details = row.locator("details").first();
  const summary = details.locator(":scope > summary");
  await expect(row).toBeVisible();
  await expect(summary).toHaveCount(1);
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await summary.click();
  }
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

async function requestLifecycle(page: Page, siteName: string, buttonName: string, reason: string) {
  const row = await openSiteActions(page, siteName);
  const button = row.getByRole("button", { name: buttonName });
  const form = button.locator("xpath=ancestor::form");
  await form.locator('textarea[name="reason"]').fill(reason);
  await button.click();
  await expect(page).toHaveURL(/status=requestCreated/u);
}

async function submitTamperedLifecycleRequest(
  page: Page,
  visibleSiteName: string,
  buttonName: string,
  target: {
    companyId: string;
    expectedVersion: number;
    siteId: string;
    tenantId: string;
  },
) {
  const row = await openSiteActions(page, visibleSiteName);
  const button = row.getByRole("button", { name: buttonName });
  const form = button.locator("xpath=ancestor::form");
  const hiddenValues: Readonly<Record<string, string>> = {
    expectedSiteVersion: String(target.expectedVersion),
    managementCompanyId: target.companyId,
    siteId: target.siteId,
    tenantId: target.tenantId,
  };
  for (const [name, value] of Object.entries(hiddenValues)) {
    await form.locator(`input[name="${name}"]`).evaluate((element, nextValue) => {
      (element as HTMLInputElement).value = nextValue;
    }, value);
  }
  await form.locator('textarea[name="reason"]').fill("Authenticated staging request scope denial");
  await button.click();
  await expect(page).toHaveURL(/error=forbidden/u);
  await page.reload();
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

async function expectLifecycleAudit(
  request: LifecycleRequestRow,
  requesterId: string,
  approverId: string,
) {
  const rows = await fixture.api.select<AuditRow>(
    "audit_logs",
    `resource_id=eq.${encodeURIComponent(request.id)}&select=action,actor_id,before_data,after_data&order=created_at.asc`,
  );
  expect(rows.map(({ action }) => action)).toEqual([
    "SITE_LIFECYCLE_REQUESTED",
    "SITE_LIFECYCLE_REQUEST_APPROVED",
  ]);
  expect(rows.map(({ actor_id }) => actor_id)).toEqual([requesterId, approverId]);
  expect(
    rows.every(({ before_data, after_data }) => auditPayloadIsSafe([before_data, after_data])),
  ).toBe(true);
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
      await signInAdmin(page, fixture.actors.superAdmin, "ko");
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
      await signInAdmin(page, fixture.actors.managementAdmin, "ko");
      await page.goto("/ko/admin/sites");
      await expect(siteRow(page, fixture.sites.companyAFirst.name)).toBeVisible();
      await expect(siteRow(page, fixture.sites.companyASecond.name)).toBeVisible();
      await expect(page.getByText(fixture.sites.tenantB.name, { exact: true })).toHaveCount(0);
      await expect(
        page.getByText(
          "직접 상태 변경 권한은 부여되지 않습니다. 허용된 범위에서 요청을 만들면 별도 플랫폼 승인자가 검토합니다.",
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
      await submitTamperedLifecycleRequest(
        page,
        fixture.sites.companyAFirst.name,
        "일시 중지 요청",
        {
          companyId: fixture.companyBId,
          expectedVersion: foreignBefore.version,
          siteId: fixture.sites.tenantB.id,
          tenantId: fixture.tenantBId,
        },
      );
      expect(await fixture.api.site(fixture.sites.tenantB.id)).toEqual(foreignBefore);
      await requestLifecycle(
        page,
        updatedName,
        "일시 중지 요청",
        "Authenticated staging Management Admin suspend request",
      );
      await openSiteActions(page, updatedName);
      await expect(
        siteRow(page, updatedName).getByText("승인 대기", { exact: true }),
      ).toBeVisible();
      await expectAudit(
        fixture.sites.companyASecond.id,
        fixture.actors.managementAdmin.id,
        ["SITE_OPERATIONAL_UPDATED"],
        fixture.sites.companyASecond.address,
      );
    });

    test("Site Admin sees and mutates only its exact Site scope", async ({ page }) => {
      await signInAdmin(page, fixture.actors.siteAdmin, "en");
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
      await submitTamperedLifecycleRequest(page, updatedName, "Request suspension", {
        companyId: fixture.companyAId,
        expectedVersion: siblingBefore.version,
        siteId: fixture.sites.companyASecond.id,
        tenantId: fixture.tenantAId,
      });
      expect(await fixture.api.site(fixture.sites.companyASecond.id)).toEqual(siblingBefore);
      await requestLifecycle(
        page,
        updatedName,
        "Request suspension",
        "Authenticated staging Site Admin suspend request",
      );
      await openSiteActions(page, updatedName);
      await expect(
        siteRow(page, updatedName).getByText("Pending approval", { exact: true }),
      ).toBeVisible();
      await expectAudit(
        fixture.sites.companyAFirst.id,
        fixture.actors.siteAdmin.id,
        ["SITE_OPERATIONAL_UPDATED"],
        fixture.sites.companyAFirst.address,
      );
    });

    test("Super Admin approves customer requests with maker-checker and redacted audit", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.superAdmin, "en");
      await page.goto("/en/admin/sites");

      const pending = await fixture.api.select<LifecycleRequestRow>(
        "site_lifecycle_requests",
        `site_id=in.(${fixture.sites.companyAFirst.id},${fixture.sites.companyASecond.id})&status=eq.PENDING&select=id,site_id,action,status,requested_by,reviewed_by&order=created_at.asc`,
      );
      expect(pending).toHaveLength(2);

      for (const request of pending) {
        const site =
          request.site_id === fixture.sites.companyAFirst.id
            ? `${fixture.sites.companyAFirst.name} Admin`
            : `${fixture.sites.companyASecond.name} Managed`;
        const card = page.locator(".admin-approval-card").filter({ hasText: site });
        await expect(card).toBeVisible();
        const form = card.locator("form").first();
        await form
          .locator('textarea[name="reason"]')
          .fill("Authenticated staging independent approval");
        await form.getByRole("button", { name: "Review and approve" }).click();
        await expect(page).toHaveURL(/status=requestApproved/u);
        await expect
          .poll(async () => {
            const rows = await fixture.api.select<LifecycleRequestRow>(
              "site_lifecycle_requests",
              `id=eq.${request.id}&select=id,site_id,action,status,requested_by,reviewed_by`,
            );
            return rows[0]?.status;
          })
          .toBe("APPROVED");
      }

      const approved = await fixture.api.select<LifecycleRequestRow>(
        "site_lifecycle_requests",
        `id=in.(${pending.map(({ id }) => id).join(",")})&select=id,site_id,action,status,requested_by,reviewed_by&order=created_at.asc`,
      );
      expect(approved).toHaveLength(2);
      expect(approved.every(({ status }) => status === "APPROVED")).toBe(true);
      expect(
        approved.every(({ reviewed_by }) => reviewed_by === fixture.actors.superAdmin.id),
      ).toBe(true);
      await expect
        .poll(async () => (await fixture.api.site(fixture.sites.companyAFirst.id)).status)
        .toBe("SUSPENDED");
      await expect
        .poll(async () => (await fixture.api.site(fixture.sites.companyASecond.id)).status)
        .toBe("SUSPENDED");

      for (const request of approved) {
        await expectLifecycleAudit(request, request.requested_by, fixture.actors.superAdmin.id);
      }
    });
  });
