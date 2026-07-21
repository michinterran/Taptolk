import { expect, type Page, test } from "@playwright/test";
import {
  createStagingFixture,
  currentTotp,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

let fixture: StagingFixture;

async function signInAndCompleteMfa(page: Page, actor: StagingActor) {
  await page.goto("/ko/admin/login");
  await expect(page.locator('input[name="area"]')).toHaveCount(0);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.getByRole("button", { name: "관리자 로그인" }).click();

  await expect(page).toHaveURL(/\/ko\/admin\/mfa\/enroll$/u);
  await page.locator(".admin-enrollment-start button").click();
  const secret = await page.locator(".admin-enrollment-secret code").textContent();
  if (!secret) {
    throw new Error("The authenticated staging MFA enrollment returned no in-memory secret.");
  }
  await page.locator('input[name="code"]').fill(await currentTotp(secret));
  await page.locator(".admin-mfa-form button[type='submit']").click();
}

test.describe
  .serial("single admin login server role routing", () => {
    test.beforeAll(async () => {
      fixture = await createStagingFixture();
    });

    test.afterAll(async () => {
      await fixture?.cleanup();
    });

    test("approved Site Admin is routed to the customer dashboard and blocked from platform UI", async ({
      page,
    }) => {
      await signInAndCompleteMfa(page, fixture.actors.siteAdmin);

      await expect(page).toHaveURL(/\/ko\/admin\/dashboard$/u);
      await expect(page.getByText("사이트 관리자", { exact: true })).toBeVisible();
      await expect(page.getByText("사이트 범위", { exact: true })).toBeVisible();
      await expect(page.getByText("MFA 인증 완료", { exact: true })).toBeVisible();

      await page.goto("/ko/admin/platform");
      await expect(page).toHaveURL(/\/ko\/admin\/dashboard$/u);
    });

    test("approved Super Admin is routed to the separate platform dashboard", async ({ page }) => {
      await signInAndCompleteMfa(page, fixture.actors.superAdmin);

      await expect(page).toHaveURL(/\/ko\/admin\/platform$/u);
      await expect(page.getByText("슈퍼어드민", { exact: true })).toBeVisible();
      await expect(page.getByText("전체 플랫폼", { exact: true })).toBeVisible();
      await expect(page.getByText("MFA 인증 완료", { exact: true })).toBeVisible();

      await page.goto("/ko/admin/dashboard");
      await expect(page).toHaveURL(/\/ko\/admin\/platform$/u);
    });
  });
