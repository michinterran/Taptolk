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
