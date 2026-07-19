import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("foundation page meets the WCJ browser baseline", async ({ page }) => {
  await page.goto("/ko");

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "전화번호를 노출하지 않고 차주에게 필요한 말을 전합니다.",
  );
  await expect(page.locator("h1 br")).toHaveCount(0);
  await expect(page.locator(".semantic-line")).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveAttribute("aria-live", "polite");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("health endpoint exposes no secret or personal data", async ({ request }) => {
  const response = await request.get("/api/health");
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body).toMatchObject({
    data: { service: "taptolk-web", status: "ready" },
    meta: { requestId: expect.any(String) },
  });
  expect(JSON.stringify(body)).not.toMatch(/phone|token|secret|authorization/iu);
});

test("foundation page is usable at narrow viewport widths", async ({ page }) => {
  await page.setViewportSize({ height: 667, width: 320 });
  await page.goto("/ko");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Korean browser preference enters the Korean route", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(/\/ko$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko-KR");
  await context.close();
});

test("foreign browser preference falls back to English", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(/\/en$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Reach the driver when it matters without exposing a phone number.",
  );
  await context.close();
});

test("explicit language selection persists over browser preference", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();

  await page.goto("/ko");
  await page.getByRole("link", { name: "영어로 보기" }).click();

  await expect(page).toHaveURL(/\/en$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/u);

  const localeCookie = (await context.cookies()).find(({ name }) => name === "taptolk_locale");
  expect(localeCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    value: "en",
  });
  await context.close();
});

test("admin sign-in foundation is bilingual and meets the accessibility baseline", async ({
  page,
}) => {
  await page.goto("/ko/admin/login");

  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "승인된 관리자 계정으로 안전하게 시작합니다.",
  );
  await expect(page.getByRole("button", { name: "관리자 로그인" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Google 계정으로 계속" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "계정 만들기" })).toHaveAttribute(
    "href",
    "/ko/admin/signup",
  );
  await expect(page.getByRole("status")).toContainText("인증 환경 연결이 필요합니다.");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "영어로 보기" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/login$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Start securely with an approved admin account.",
  );
});

test("admin sign-in remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ height: 667, width: 320 });
  await page.goto("/en/admin/login");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByLabel("Admin email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("admin account creation offers email and Google in both languages", async ({ page }) => {
  await page.goto("/ko/admin/signup");

  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "업무 계정을 만들고 승인된 운영 범위를 연결합니다.",
  );
  await expect(page.getByRole("button", { name: "이메일로 계정 만들기" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Google 계정으로 가입" })).toBeDisabled();
  await expect(
    page.getByText("관리자 권한은 자동 부여되지 않습니다", { exact: false }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "영어로 보기" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/signup$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Create a work account and connect an approved operating scope.",
  );
});

test("admin account creation remains usable at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ height: 760, width: 320 });
  await page.goto("/en/admin/signup");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
});

test("the account approval center is never exposed without an authenticated admin session", async ({
  page,
}) => {
  await page.goto("/ko/admin/platform/access");

  await expect(page).toHaveURL(/\/ko\/admin\/login\?error=configuration$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "승인된 관리자 계정으로 안전하게 시작합니다.",
  );
  await expect(page.getByText("가입 승인 센터", { exact: true })).toHaveCount(0);
});

test("the management company catalog is never exposed without an authenticated admin session", async ({
  page,
}) => {
  await page.goto("/en/admin/platform/management-companies");

  await expect(page).toHaveURL(/\/en\/admin\/login\?error=configuration$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Start securely with an approved admin account.",
  );
  await expect(page.getByText("Management company operations", { exact: true })).toHaveCount(0);
});

test("the site catalog is never exposed without an authenticated admin session", async ({
  page,
}) => {
  await page.goto("/ko/admin/sites");

  await expect(page).toHaveURL(/\/ko\/admin\/login\?error=configuration$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "승인된 관리자 계정으로 안전하게 시작합니다.",
  );
  await expect(page.getByText("역할별 사이트 운영", { exact: true })).toHaveCount(0);
});
