import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public landing introduces the service without any administrator entrance", async ({
  page,
}) => {
  await page.goto("/ko");

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "차량에 연락이 필요할 때, 전화번호를 몰라도 괜찮습니다.",
  );
  await expect(page.locator("h1 br")).toHaveCount(0);
  await expect(page.locator("h1 .semantic-line")).toHaveCount(2);
  await expect(page.getByText("Phase 0", { exact: false })).toHaveCount(0);
  await expect(page.getByText("기초 구조", { exact: false })).toHaveCount(0);

  // The public surface must not advertise the administrator portal in any form.
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
  // Explanatory copy may mention that no account is needed; what must not exist is an
  // actionable sign-in or sign-up control.
  await expect(page.getByRole("link", { name: /로그인|가입/u })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /로그인|가입/u })).toHaveCount(0);

  // Caller guidance, owner guidance, privacy, and FAQ are the required sections.
  await expect(page.locator("#how-it-works")).toBeVisible();
  await expect(page.locator("#privacy")).toBeVisible();
  await expect(page.locator("#faq")).toBeVisible();
  await expect(page.getByText("QR 스캔", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("스티커 수령", { exact: false })).toBeVisible();

  // No control may suggest a request can start without an issued QR.
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator('a[href^="/ko/q/"]')).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("role onboarding stays token-led and exposes no administrator entrance", async ({ page }) => {
  await page.goto("/ko/onboarding");

  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "지금 하려는 일에 맞는 안전한 입구를 선택하세요.",
  );
  await expect(page.getByText("차량의 Taptolk QR을 카메라로 스캔하세요.")).toBeVisible();
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/ko/q/"]')).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("administrator portal introduces the workspace and keeps one canonical sign-in", async ({
  page,
}) => {
  await page.goto("/ko/admin");

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "QR 발급부터 차량 연락 운영까지, 관리회사 업무를 한곳에서 관리합니다.",
  );

  // Management-company explanation sections.
  await expect(page.locator("#workflow")).toBeVisible();
  await expect(page.locator("#features")).toBeVisible();
  await expect(page.locator("#approval")).toBeVisible();

  // Existing canonical authentication entries, and no browser-selected role.
  await expect(page.locator('a[href="/ko/admin/login"]').first()).toBeVisible();
  await expect(page.locator('a[href="/ko/admin/signup"]').first()).toBeVisible();
  await expect(page.locator('a[href="/ko/admin/platform/login"]')).toHaveCount(0);
  await expect(page.locator('input[name="area"]')).toHaveCount(0);

  // Signing up must be described as an approval request, not an access grant.
  await expect(page.getByText("승인", { exact: false }).first()).toBeVisible();

  // Enterprise SSO is not implemented and must not be advertised.
  await expect(page.getByText("SSO", { exact: false })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("administrator portal is excluded from search indexes", async ({ page, request }) => {
  await page.goto("/ko/admin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/ko\/admin/u);
  expect(robots).toMatch(/Disallow: \/ko\/q\//u);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toMatch(/\/admin/u);
  expect(sitemap).not.toMatch(/\/q\//u);
  expect(sitemap).toMatch(/\/ko</u);
});

test("administrator portal locale entry resolves without a locale segment", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/ko\/admin$/u);
  await context.close();
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

test("scheduled privacy cleanup fails closed without server configuration", async ({ request }) => {
  const response = await request.get("/api/internal/privacy-cleanup");
  const body = await response.json();

  expect(response.status()).toBe(503);
  expect(body).toMatchObject({
    error: { code: "UNAVAILABLE", retryable: false },
    meta: { requestId: expect.any(String) },
  });
  expect(JSON.stringify(body)).not.toMatch(/tenantId|tenant_id|phone|token|secret|authorization/iu);
});

test("landing and onboarding are usable at narrow viewport widths", async ({ page }) => {
  await page.setViewportSize({ height: 667, width: 320 });
  await page.goto("/ko");

  const landingOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(landingOverflow).toBe(false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/ko/onboarding");
  const onboardingOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(onboardingOverflow).toBe(false);
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
    "Need to reach a vehicle? You don't need the owner's number.",
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
  await expect(page.getByRole("status")).toContainText("로그인 준비 중입니다.");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "영어로 보기" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/login$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Start securely with an approved admin account.",
  );
});

test("legacy platform login redirects to the single localized administrator entry", async ({
  page,
}) => {
  await page.goto("/ko/admin/platform/login");

  await expect(page).toHaveURL(/\/ko\/admin\/login$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "승인된 관리자 계정으로 안전하게 시작합니다.",
  );
  await expect(page.getByRole("button", { name: "관리자 로그인" })).toBeDisabled();
  await expect(page.locator('input[name="area"]')).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "영어로 보기" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/login$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Start securely with an approved admin account.",
  );
});

test("admin sign-in renders the localized expired-session state", async ({ page }) => {
  await page.goto("/ko/admin/login?error=session");

  await expect(page.locator(".admin-form-error")).toHaveText(
    "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
  );
  await page.getByRole("link", { name: "영어로 보기" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/login\?error=session$/u);
  await expect(page.locator(".admin-form-error")).toHaveText(
    "Your session has expired. Sign in again.",
  );
});

test("admin sign-in keeps semantic heading rhythm and no overflow at reviewed widths", async ({
  page,
}) => {
  for (const width of [320, 768, 1280, 1920]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/en/admin/login");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    await expect(page.locator("h1 br")).toHaveCount(0);
    await expect(page.locator("h1 .semantic-line")).toHaveCount(2);
    await expect(page.getByLabel("Admin email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  }
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

test("the QR inventory and sample workspace is never exposed without an admin session", async ({
  page,
}) => {
  await page.goto("/en/admin/qr-inventory");

  await expect(page).toHaveURL(/\/en\/admin\/login\?error=configuration$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Start securely with an approved admin account.",
  );
  await expect(page.getByText("QR inventory and sample approval", { exact: true })).toHaveCount(0);
});
