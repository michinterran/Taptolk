import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  createStagingFixture,
  loadStagingEnvironment,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

let fixture: StagingFixture;
let approvalPendingActor: StagingActor | null = null;

interface PasswordSession {
  access_token?: string;
}

const PENDING_ACCOUNT_OPERATIONAL_TABLES = [
  "tenants",
  "management_companies",
  "sites",
  "qr_batches",
  "operations_metric_snapshots",
] as const;

async function signInAdmin(page: Page, actor: StagingActor) {
  await page.goto("/ko/admin/login");
  await expect(page.locator('input[name="area"]')).toHaveCount(0);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.getByRole("button", { name: "관리자 로그인" }).click();
}

async function createApprovalPendingActor(): Promise<StagingActor> {
  const suffix = randomUUID();
  const actor: StagingActor = {
    email: `taptolk-e2e-pending-${suffix}@example.com`,
    id: "",
    password: `Tt!${randomUUID()}9a`,
    role: "SITE_ADMIN",
  };
  return { ...actor, id: await fixture.api.createUser(actor.email, actor.password) };
}

async function visibleOperationalRowCounts(actor: StagingActor): Promise<number[]> {
  const environment = loadStagingEnvironment();
  const tokenResponse = await fetch(
    `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      body: JSON.stringify({ email: actor.email, password: actor.password }),
      headers: {
        apikey: environment.publishableKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(`Approval-pending staging sign-in failed with HTTP ${tokenResponse.status}.`);
  }
  const accessToken = ((await tokenResponse.json()) as PasswordSession).access_token;
  if (!accessToken) {
    throw new Error("The approval-pending staging session is unavailable.");
  }

  return Promise.all(
    PENDING_ACCOUNT_OPERATIONAL_TABLES.map(async (table) => {
      const response = await fetch(
        `${environment.supabaseUrl}/rest/v1/${table}?select=id&limit=1`,
        {
          headers: {
            apikey: environment.publishableKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Approval-pending RLS probe for ${table} failed with HTTP ${response.status}.`,
        );
      }
      const rows = (await response.json()) as unknown[];
      return rows.length;
    }),
  );
}

test.describe
  .serial("single admin login server role routing", () => {
    test.beforeAll(async () => {
      fixture = await createStagingFixture();
      approvalPendingActor = await createApprovalPendingActor();
    });

    test.afterAll(async () => {
      if (approvalPendingActor) {
        await fixture?.api.deleteUser(approvalPendingActor.id);
      }
      await fixture?.cleanup();
    });

    test("approved Site Admin is routed to the customer dashboard and blocked from platform UI", async ({
      page,
    }) => {
      await signInAdmin(page, fixture.actors.siteAdmin);

      await expect(page).toHaveURL(/\/ko\/admin\/dashboard$/u);
      const customerSidebar = page.getByRole("complementary");
      await expect(
        page.locator(".admin-console-account-menu").getByText("사이트 관리자", { exact: true }),
      ).toBeVisible();
      await expect(customerSidebar.getByText("사이트 범위", { exact: true })).toBeVisible();
      await expect(customerSidebar.getByText("비밀번호 인증", { exact: true })).toBeVisible();
      const customerNavigation = page.getByRole("navigation", {
        name: "관리자 운영 메뉴",
      });
      await expect(customerNavigation.getByRole("link", { name: "대시보드" })).toBeVisible();
      await expect(customerNavigation.getByRole("link", { name: "관리 현장" })).toBeVisible();
      await expect(customerNavigation.getByRole("link", { name: "QR 제작 관리" })).toBeVisible();
      await expect(customerNavigation.getByRole("link", { name: "운영 모니터링" })).toBeVisible();
      await expect(customerNavigation.getByRole("link", { name: "관리회사" })).toHaveCount(0);
      await expect(customerNavigation.getByRole("link", { name: "매출 관리" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "운영 한눈에 보기" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "고객과 계약 상태를 한눈에 관리하세요" }),
      ).toBeVisible();
      await page.locator(".admin-console-account-menu > summary").click();
      await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

      await page.goto("/ko/admin/platform");
      await expect(page).toHaveURL(/\/ko\/admin\/dashboard$/u);
    });

    test("approved Super Admin is routed to the separate platform dashboard", async ({ page }) => {
      await signInAdmin(page, fixture.actors.superAdmin);

      await expect(page).toHaveURL(/\/ko\/admin\/platform$/u);
      const platformSidebar = page.getByRole("complementary");
      await expect(
        page.locator(".admin-console-account-menu").getByText("슈퍼어드민", { exact: true }),
      ).toBeVisible();
      await expect(platformSidebar.getByText("전체 플랫폼", { exact: true })).toBeVisible();
      await expect(platformSidebar.getByText("비밀번호 인증", { exact: true })).toBeVisible();
      const platformNavigation = page.getByRole("navigation", {
        name: "관리자 운영 메뉴",
      });
      await expect(platformNavigation.getByRole("link", { name: "대시보드" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "관리회사" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "QR 제작 관리" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "운영 모니터링" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "리포트" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "매출 관리" })).toBeVisible();
      await expect(platformNavigation.getByRole("link", { name: "계정·권한" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "운영 한눈에 보기" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "고객과 계약 상태를 한눈에 관리하세요" }),
      ).toBeVisible();
      await page.locator(".admin-console-account-menu > summary").click();
      await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();

      await page.goto("/ko/admin/dashboard");
      await expect(page).toHaveURL(/\/ko\/admin\/platform$/u);
    });

    test("approval-pending account is denied every admin workspace and sees zero operational rows", async ({
      page,
    }) => {
      if (!approvalPendingActor) {
        throw new Error("The approval-pending staging actor was not created.");
      }

      await page.goto("/ko/admin/login");
      await page.locator('input[name="email"]').fill(approvalPendingActor.email);
      await page.locator('input[name="password"]').fill(approvalPendingActor.password);
      await page.getByRole("button", { name: "관리자 로그인" }).click();
      await expect(page).toHaveURL(/\/ko\/admin\/access$/u);

      for (const path of [
        "/ko/admin/dashboard",
        "/ko/admin/sites",
        "/ko/admin/qr-inventory",
        "/ko/admin/operations",
        "/ko/admin/platform",
      ]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/ko\/admin\/access$/u);
      }

      await expect(visibleOperationalRowCounts(approvalPendingActor)).resolves.toEqual([
        0, 0, 0, 0, 0,
      ]);
    });
  });
