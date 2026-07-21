import { createCipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  createStagingFixture,
  currentTotp,
  loadStagingEnvironment,
  type StagingActor,
  type StagingFixture,
} from "./staging-fixture";

interface PublicContactFixture {
  assetId: string;
  ownerId: string;
  publicToken: string;
  publicTokenHash: string;
}

interface PasswordSession {
  access_token?: string;
}

let fixture: StagingFixture;
let contactFixture: PublicContactFixture;
let contractId: string;
const mfaSecrets = new Map<string, string>();

async function signInAndSatisfyMfa(page: Page, actor: StagingActor, locale: "en" | "ko") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.locator('button[type="submit"]').first().click();
  const existingSecret = mfaSecrets.get(actor.id);
  if (existingSecret) {
    await page.locator('input[name="code"]').fill(await currentTotp(existingSecret));
    await page.locator(".admin-mfa-form button[type='submit']").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/admin(?:/(?:platform|dashboard))?$`, "u"));
    return;
  }
  await page.locator(".admin-enrollment-start button").click();
  const secret = await page.locator(".admin-enrollment-secret code").textContent();
  if (!secret) {
    throw new Error("The staging MFA enrollment returned no TOTP secret.");
  }
  mfaSecrets.set(actor.id, secret);
  await page.locator('input[name="code"]').fill(await currentTotp(secret));
  await page.locator(".admin-mfa-form button[type='submit']").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin(?:/(?:platform|dashboard))?$`, "u"));
}

function publicContactHmac(value: string, purpose: string): string {
  const secret = process.env.TOKEN_HMAC_KEY;
  if (!secret) {
    throw new Error("Public contact staging HMAC configuration is unavailable.");
  }
  const rootKey = createHash("sha256").update(`public-contact-root\0${secret}`, "utf8").digest();
  const purposeKey = createHmac("sha256", rootKey)
    .update(`public-contact-${purpose}`, "utf8")
    .digest();
  return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
}

function randomHash(): string {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}

function protectStagingPhone(value: string): string {
  const secret = process.env.APP_ENCRYPTION_KEY_V1;
  if (!secret) {
    throw new Error("Notification staging encryption configuration is unavailable.");
  }
  const key = createHash("sha256").update(`owner-encryption\0${secret}`, "utf8").digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("owner:phone:v1", "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function notificationTokenHash(value: string): string {
  const secret = process.env.TOKEN_HMAC_KEY;
  if (!secret) {
    throw new Error("Notification staging HMAC configuration is unavailable.");
  }
  const rootKey = createHash("sha256")
    .update(`notification-reply-root\0${secret}`, "utf8")
    .digest();
  const purposeKey = createHmac("sha256", rootKey)
    .update("notification-response-token", "utf8")
    .digest();
  return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
}

async function authenticatedRpc(
  actor: StagingFixture["actors"]["siteAdmin"],
  functionName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const environment = loadStagingEnvironment();
  const tokenResponse = await fetch(
    `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      body: JSON.stringify({ email: actor.email, password: actor.password }),
      headers: {
        apikey: environment.secretKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  expect(tokenResponse.ok).toBe(true);
  const accessToken = ((await tokenResponse.json()) as PasswordSession).access_token;
  if (!accessToken) {
    throw new Error("Authenticated staging RPC session is unavailable.");
  }
  const response = await fetch(
    `${environment.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
    {
      body: JSON.stringify(input),
      headers: {
        apikey: environment.secretKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  expect(response.ok).toBe(true);
  return response.json();
}

async function internalRequest(
  path: string,
  bearer: string,
  options: {
    body?: Record<string, unknown>;
    method?: "DELETE" | "GET" | "POST";
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`http://127.0.0.1:3200${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET",
    signal: AbortSignal.timeout(5 * 60_000),
  });
}

test.describe
  .serial("Public Contact staging acceptance", () => {
    test.beforeAll(async () => {
      loadStagingEnvironment();
      fixture = await createStagingFixture();
      const publicToken = randomBytes(32).toString("base64url");
      const publicTokenHash = publicContactHmac(publicToken, "public-token");
      const suffix = randomBytes(5).toString("hex").toUpperCase();
      const fixtureLabel = `PC-A${suffix}`;
      contractId = await fixture.api.rpc<string>(
        "provision_public_contact_contract_staging_fixture",
        {
          p_fixture_label: fixtureLabel,
          p_management_company_id: fixture.companyAId,
          p_site_id: fixture.sites.companyAFirst.id,
          p_tenant_id: fixture.tenantAId,
        },
      );
      const provisioned = await fixture.api.rpc<{ asset_id: string; owner_id: string }>(
        "provision_public_contact_staging_fixture",
        {
          p_activation_code_hash: randomHash(),
          p_approver_id: fixture.actors.superAdmin.id,
          p_fixture_label: fixtureLabel,
          p_management_company_id: fixture.companyAId,
          p_phone_hash: randomHash(),
          p_plate_hash: randomHash(),
          p_plate_last4: "7098",
          p_public_token_hash: publicTokenHash,
          p_requester_id: fixture.actors.siteAdmin.id,
          p_site_id: fixture.sites.companyAFirst.id,
          p_tenant_id: fixture.tenantAId,
        },
      );
      contactFixture = {
        assetId: provisioned.asset_id,
        ownerId: provisioned.owner_id,
        publicToken,
        publicTokenHash,
      };
      await fixture.api.rpc("prepare_notification_reply_staging_fixture", {
        p_owner_id: contactFixture.ownerId,
        p_phone_ciphertext: protectStagingPhone("01000000000"),
        p_phone_key_version: 1,
        p_phone_last4: "0000",
        p_tenant_id: fixture.tenantAId,
      });
    });

    test.afterAll(async () => {
      if (contactFixture) {
        await fixture.api.deleteWhere(
          "operations_metric_snapshots",
          `tenant_id=eq.${fixture.tenantAId}`,
        );
        await fixture.api.deleteWhere("privacy_cleanup_runs", `tenant_id=eq.${fixture.tenantAId}`);
        await fixture.api.deleteWhere("caller_blocks", `tenant_id=eq.${fixture.tenantAId}`);
        await fixture.api.deleteWhere("contact_reports", `tenant_id=eq.${fixture.tenantAId}`);
        await fixture.api.deleteWhere("abuse_events", `tenant_id=eq.${fixture.tenantAId}`);
        await fixture.api.rpc("cleanup_public_contact_staging_fixture", {
          p_public_token_hash: contactFixture.publicTokenHash,
          p_tenant_id: fixture.tenantAId,
        });
      }
      if (contractId) {
        await fixture.api.rpc("cleanup_public_contact_contract_staging_fixture", {
          p_contract_id: contractId,
          p_tenant_id: fixture.tenantAId,
        });
      }
      await fixture?.cleanup();
      const residueTables = [
        "contact_sessions",
        "session_participants",
        "messages",
        "notification_deliveries",
        "public_contact_attempts",
        "response_tokens",
        "abuse_events",
        "contact_reports",
        "caller_blocks",
        "operations_metric_snapshots",
        "privacy_cleanup_runs",
        "owners",
      ] as const;
      for (const table of residueTables) {
        expect(
          await fixture.api.select<{ id: string }>(table, "select=id&limit=1"),
          `${table} residue`,
        ).toEqual([]);
      }
      for (const actor of Object.values(fixture.actors)) {
        expect(await fixture.api.authUserExists(actor.id)).toBe(false);
      }
    });

    test("KO Caller submits under 20 seconds, restores, merges, and exposes no Owner data", async ({
      page,
    }) => {
      await page.goto(`/en/q/${encodeURIComponent(contactFixture.publicToken)}`);
      for (const width of [320, 768, 1280, 1920]) {
        await page.setViewportSize({ height: 900, width });
        await expect(
          page.getByRole("heading", {
            name: /Send a message to the owner without exposing a phone number/u,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }

      await page.goto(`/ko/q/${encodeURIComponent(contactFixture.publicToken)}`);
      await expect(
        page.getByRole("heading", { name: /전화번호 노출 없이 차주에게 메시지를 전달합니다/u }),
      ).toBeVisible();
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const vehicleButton = page.getByRole("button", { name: "이 차량이 맞습니다" });
      await expect(vehicleButton).toBeVisible();
      for (let index = 0; index < 5; index += 1) {
        if (await vehicleButton.evaluate((element) => element === document.activeElement)) {
          break;
        }
        await page.keyboard.press("Tab");
      }
      await expect(vehicleButton).toBeFocused();
      await expect(page.getByText("•••• 7098")).toBeVisible();
      await vehicleButton.click();
      await page.getByRole("button", { name: "차량 이동" }).click();
      await expect(page.getByText("차량 이동을 부탁드립니다.")).toBeVisible();

      const warmupResponse = await page.request.get("/api/public/contact-sessions");
      expect(warmupResponse.status()).toBe(405);
      const startedAt = Date.now();
      const createResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/public/contact-sessions"),
      );
      await page.getByRole("button", { name: "요청 접수하기" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);
      expect(Date.now() - startedAt).toBeLessThan(20_000);
      await expect(page).toHaveURL(/\/ko\/c\/current$/u);
      await expect(page.getByText("차주 알림을 준비하는 중")).toBeVisible();
      const currentResponse = await page.request.get("/api/public/contact-sessions/current");
      expect(currentResponse.status()).toBe(200);
      const currentPayloadText = await currentResponse.text();
      expect(currentPayloadText).not.toContain(contactFixture.ownerId);
      expect(currentPayloadText).not.toMatch(/owner_id|phone|destination_hash|session_token/iu);

      const originalCookies = await page.context().cookies();
      const anonymousCookie = originalCookies.find(({ name }) => name === "tt_caller_anon");
      const sessionCookie = originalCookies.find(({ name }) => name === "tt_contact_session");
      expect(anonymousCookie).toEqual(expect.objectContaining({ httpOnly: true, sameSite: "Lax" }));
      expect(sessionCookie).toEqual(expect.objectContaining({ httpOnly: true, sameSite: "Lax" }));

      const restored = await page.context().newPage();
      await restored.goto("/ko/c/current");
      await expect(restored.getByText("차주 알림을 준비하는 중")).toBeVisible();
      await restored.close();

      await page.goto(`/ko/q/${encodeURIComponent(contactFixture.publicToken)}`);
      await page.getByRole("button", { name: "이 차량이 맞습니다" }).click();
      await page.getByRole("button", { name: "차량 이동" }).click();
      const mergeResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/public/contact-sessions"),
      );
      await page.getByRole("button", { name: "요청 접수하기" }).click();
      const mergeResponse = await mergeResponsePromise;
      expect(mergeResponse.status()).toBe(200);
      await expect(page).toHaveURL(/\/ko\/c\/current$/u);

      const [sessions, messages, deliveries, createdAttempts, mergedAttempts] = await Promise.all([
        fixture.api.select<{ id: string }>(
          "contact_sessions",
          `qr_asset_id=eq.${contactFixture.assetId}&select=id`,
        ),
        fixture.api.select<{ id: string }>(
          "messages",
          `tenant_id=eq.${fixture.tenantAId}&select=id`,
        ),
        fixture.api.select<{ channel: string; id: string; status: string }>(
          "notification_deliveries",
          `tenant_id=eq.${fixture.tenantAId}&select=id,status,channel`,
        ),
        fixture.api.select<{ id: string }>(
          "public_contact_attempts",
          `qr_asset_id=eq.${contactFixture.assetId}&result=eq.CREATED&select=id`,
        ),
        fixture.api.select<{ id: string }>(
          "public_contact_attempts",
          `qr_asset_id=eq.${contactFixture.assetId}&result=eq.MERGED&select=id`,
        ),
      ]);
      expect(sessions).toHaveLength(1);
      expect(messages).toHaveLength(1);
      expect(deliveries).toEqual([
        expect.objectContaining({ channel: "KAKAO_ALIMTALK", status: "QUEUED" }),
      ]);
      expect(createdAttempts).toHaveLength(1);
      expect(mergedAttempts).toHaveLength(1);

      await page.context().addCookies([
        {
          domain: "localhost",
          httpOnly: true,
          name: "tt_caller_anon",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: randomBytes(32).toString("base64url"),
        },
      ]);
      expect((await page.request.get("/api/public/contact-sessions/current")).status()).toBe(400);
      if (!anonymousCookie || !sessionCookie) {
        throw new Error("Caller recovery cookies are unavailable.");
      }
      await page.context().addCookies([anonymousCookie, sessionCookie]);
      expect((await page.request.get("/api/public/contact-sessions/current")).status()).toBe(200);
    });

    test("message policy rejects URL, phone, email, and over-limit input before persistence", async ({
      request,
    }) => {
      const invalidMessages = [
        "https://example.com",
        "010-1234-5678",
        "caller@example.com",
        "가".repeat(201),
      ];
      for (const message of invalidMessages) {
        const response = await request.post("/api/public/contact-sessions", {
          data: {
            locale: "ko",
            message,
            messageMode: "FREE_TEXT",
            plateLast4: "7098",
            publicToken: contactFixture.publicToken,
            reasonCode: "OTHER",
          },
          headers: { Origin: "http://localhost:3200" },
        });
        expect(response.status()).toBe(400);
      }
      expect(
        await fixture.api.select<{ id: string }>(
          "messages",
          `tenant_id=eq.${fixture.tenantAId}&select=id`,
        ),
      ).toHaveLength(1);
    });

    test("Worker retries, recovers an expired lease, sends once, and Owner reply reaches Caller", async ({
      page,
    }) => {
      test.setTimeout(10 * 60_000);
      const workerSecret = process.env.QUEUE_WORKER_SECRET;
      if (!workerSecret) {
        throw new Error("Notification Worker staging authorization is unavailable.");
      }
      expect(
        (
          await internalRequest("/api/internal/notification-staging", workerSecret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await internalRequest("/api/internal/notification-staging", workerSecret, {
            body: { failureCode: "TEMPORARY_FAILURE" },
            method: "POST",
          })
        ).status,
      ).toBe(200);
      const firstDispatch = await internalRequest(
        "/api/internal/notification-dispatch",
        workerSecret,
        { method: "POST" },
      );
      expect(firstDispatch.status).toBe(200);
      expect(await firstDispatch.json()).toMatchObject({
        data: { claimed: 1, retryScheduled: 1, sent: 0 },
      });
      const [retryDelivery] = await fixture.api.select<{
        id: string;
        retry_count: number;
        status: string;
      }>(
        "notification_deliveries",
        `tenant_id=eq.${fixture.tenantAId}&status=eq.FAILED_RETRYABLE&select=id,retry_count,status`,
      );
      expect(retryDelivery).toEqual(expect.objectContaining({ retry_count: 1 }));
      await fixture.api.updateWhere("notification_deliveries", `id=eq.${retryDelivery.id}`, {
        scheduled_at: new Date(Date.now() - 1_000).toISOString(),
      });
      expect(
        (
          await internalRequest("/api/internal/notification-dispatch", workerSecret, {
            method: "POST",
          })
        ).status,
      ).toBe(200);

      const firstInbox = (await (
        await internalRequest("/api/internal/notification-staging", workerSecret)
      ).json()) as { data: Array<{ idempotencyKey: string; responseToken: string }> };
      expect(firstInbox.data).toHaveLength(1);
      const firstTokenHash = notificationTokenHash(firstInbox.data[0].responseToken);
      await fixture.api.updateWhere("response_tokens", `token_hash=eq.${firstTokenHash}`, {
        created_at: new Date(Date.now() - 3_601_000).toISOString(),
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      });
      await page.goto(`/ko/respond/${encodeURIComponent(firstInbox.data[0].responseToken)}`);
      await expect(page.getByText("링크가 만료되었거나 이미 사용되었습니다.")).toBeVisible();

      await page.goto(`/ko/q/${encodeURIComponent(contactFixture.publicToken)}`);
      await page.getByRole("button", { name: "이 차량이 맞습니다" }).click();
      await page.getByRole("button", { name: "출입구 차단" }).click();
      await page.getByRole("button", { name: "요청 접수하기" }).click();
      await expect(page).toHaveURL(/\/ko\/c\/current$/u);

      const [pendingDelivery] = await fixture.api.select<{
        id: string;
        idempotency_key: string;
        session_id: string;
      }>(
        "notification_deliveries",
        `tenant_id=eq.${fixture.tenantAId}&status=eq.QUEUED&select=id,idempotency_key,session_id&order=created_at.desc&limit=1`,
      );
      const staleWorker = "expired-worker-01";
      const staleClaims = await fixture.api.rpc<
        Array<{ delivery_id: string; lease_version: number }>
      >("claim_notification_deliveries", {
        p_lease_seconds: 30,
        p_limit: 1,
        p_worker_id: staleWorker,
      });
      expect(staleClaims).toHaveLength(1);
      const staleToken = randomBytes(32).toString("base64url");
      await fixture.api.rpc("attach_notification_response_token", {
        p_delivery_id: staleClaims[0].delivery_id,
        p_lease_version: staleClaims[0].lease_version,
        p_token_hash: notificationTokenHash(staleToken),
        p_ttl_seconds: 3600,
        p_worker_id: staleWorker,
      });
      await fixture.api.updateWhere("notification_deliveries", `id=eq.${pendingDelivery.id}`, {
        lease_expires_at: new Date(Date.now() - 1_000).toISOString(),
      });
      const recoveredDispatch = await internalRequest(
        "/api/internal/notification-dispatch",
        workerSecret,
        { method: "POST" },
      );
      expect(await recoveredDispatch.json()).toMatchObject({
        data: { claimed: 1, failedFinal: 0, sent: 1 },
      });
      expect(
        (
          await internalRequest("/api/internal/notification-dispatch", workerSecret, {
            method: "POST",
          })
        ).status,
      ).toBe(200);

      const inbox = (await (
        await internalRequest("/api/internal/notification-staging", workerSecret)
      ).json()) as { data: Array<{ idempotencyKey: string; responseToken: string }> };
      const responseItem = inbox.data.find(
        ({ idempotencyKey }) => idempotencyKey === pendingDelivery.idempotency_key,
      );
      expect(responseItem).toBeTruthy();
      expect(new Set(inbox.data.map(({ idempotencyKey }) => idempotencyKey)).size).toBe(2);
      const tokenRows = await fixture.api.select<{
        revoked_at: string | null;
        token_hash: string;
      }>("response_tokens", `delivery_id=eq.${pendingDelivery.id}&select=token_hash,revoked_at`);
      expect(tokenRows).toHaveLength(2);
      expect(tokenRows.filter(({ revoked_at }) => revoked_at === null)).toHaveLength(1);
      if (!responseItem) {
        throw new Error("Recovered notification has no staging response token.");
      }
      const ownerPage = await page.context().newPage();
      await ownerPage.goto(`/ko/respond/${encodeURIComponent(responseItem.responseToken)}`);
      await expect(
        ownerPage.getByRole("heading", { name: /차량 연락 요청을 확인하고 간단히 답장해 주세요/u }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page: ownerPage }).analyze()).violations).toEqual([]);
      await ownerPage.keyboard.press("Tab");
      await expect(ownerPage.getByLabel("지금 이동할게요")).toBeFocused();
      await ownerPage.getByRole("button", { name: "답장 보내기" }).click();
      await expect(ownerPage.getByText("답장이 전달되었습니다.")).toBeVisible();
      await ownerPage.close();
      await page.reload();
      await expect(page.getByText("지금 이동하겠습니다.")).toBeVisible();
      await page.getByRole("button", { name: "요청 완료하기" }).click();
      await expect(page.getByText("요청이 완료되었습니다.")).toBeVisible();
      expect((await page.request.get("/api/public/contact-sessions/current")).status()).toBe(401);
      const terminalCookies = await page.context().cookies();
      expect(terminalCookies.some(({ name }) => name === "tt_caller_anon")).toBe(false);
      expect(terminalCookies.some(({ name }) => name === "tt_contact_session")).toBe(false);
      expect(
        await fixture.api.select<{ id: string }>(
          "contact_sessions",
          `id=eq.${pendingDelivery.session_id}&status=eq.RESOLVED&select=id`,
        ),
      ).toHaveLength(1);
      expect(
        await fixture.api.select<{ body: string; body_hash: string }>(
          "messages",
          `session_id=eq.${pendingDelivery.session_id}&select=body,body_hash`,
        ),
      ).toEqual([
        { body: "[REDACTED]", body_hash: "0".repeat(64) },
        { body: "[REDACTED]", body_hash: "0".repeat(64) },
      ]);
      expect(
        await fixture.api.select<{ id: string }>(
          "response_tokens",
          `session_id=eq.${pendingDelivery.session_id}&revoked_at=not.is.null&select=id`,
        ),
      ).toHaveLength(2);
      expect(
        await fixture.api.select<{ id: string }>(
          "session_participants",
          `session_id=eq.${pendingDelivery.session_id}&left_at=is.null&select=id`,
        ),
      ).toEqual([]);
      expect(
        await fixture.api.select<{ id: string }>(
          "audit_logs",
          `resource_id=eq.${pendingDelivery.session_id}&action=eq.PUBLIC_CONTACT_RESOLVED&select=id`,
        ),
      ).toHaveLength(1);
      expect(
        await fixture.api.select<{ id: string }>(
          "notification_deliveries",
          `tenant_id=eq.${fixture.tenantAId}&status=eq.PROCESSING&select=id`,
        ),
      ).toEqual([]);
    });

    test("180-second escalation, scoped report disposition, and caller block are exact", async ({
      page,
    }) => {
      await page.goto(`/ko/q/${encodeURIComponent(contactFixture.publicToken)}`);
      await page.getByRole("button", { name: "이 차량이 맞습니다" }).click();
      await page.getByRole("button", { name: "라이트 켜짐" }).click();
      await page.getByRole("button", { name: "요청 접수하기" }).click();
      await expect(page).toHaveURL(/\/ko\/c\/current$/u);

      const [session] = await fixture.api.select<{ id: string }>(
        "contact_sessions",
        `qr_asset_id=eq.${contactFixture.assetId}&select=id&order=created_at.desc&limit=1`,
      );
      if (!session) {
        throw new Error("Escalation staging session is unavailable.");
      }
      await fixture.api.updateWhere("contact_sessions", `id=eq.${session.id}`, {
        created_at: new Date().toISOString(),
        status: "OWNER_NOTIFIED",
      });
      expect((await page.request.post("/api/public/contact-sessions/escalation")).status()).toBe(
        400,
      );
      await fixture.api.updateWhere("contact_sessions", `id=eq.${session.id}`, {
        created_at: new Date(Date.now() - 181_000).toISOString(),
      });
      await page.reload();
      await expect(page.getByRole("button", { name: "관리사무소에 알리기" })).toBeVisible();
      await page.getByRole("button", { name: "관리사무소에 알리기" }).click();
      await expect(page.getByText("관리사무소 알림을 접수했습니다.")).toBeVisible();
      expect((await page.request.post("/api/public/contact-sessions/escalation")).status()).toBe(
        400,
      );

      const officeAlerts = await fixture.api.select<{ id: string }>(
        "notification_deliveries",
        `session_id=eq.${session.id}&purpose=eq.ADMIN_ALERT&select=id`,
      );
      expect(officeAlerts).toHaveLength(1);
      const reportResponse = await page.request.post("/api/public/contact-sessions/report", {
        data: { reasonCode: "OWNER_REPLY_CONCERN" },
        headers: { Origin: "http://localhost:3200" },
      });
      expect(reportResponse.status()).toBe(200);
      const [report] = await fixture.api.select<{ id: string; status: string }>(
        "contact_reports",
        `session_id=eq.${session.id}&select=id,status`,
      );
      expect(report).toEqual(expect.objectContaining({ status: "OPEN" }));
      if (!report) {
        throw new Error("Contact report staging row is unavailable.");
      }
      await authenticatedRpc(fixture.actors.siteAdmin, "process_contact_report", {
        p_block_hours: 24,
        p_reason: "Reviewed staging caller evidence",
        p_report_id: report.id,
        p_status: "BLOCKED",
      });
      expect(
        await fixture.api.select<{ id: string }>(
          "caller_blocks",
          `tenant_id=eq.${fixture.tenantAId}&select=id`,
        ),
      ).toHaveLength(1);

      const blockedResponse = await page.request.post("/api/public/contact-sessions", {
        data: {
          locale: "ko",
          message: "차량 창문이 열려 있습니다.",
          messageMode: "TEMPLATE",
          plateLast4: "7098",
          publicToken: contactFixture.publicToken,
          reasonCode: "WINDOW_OPEN",
        },
        headers: { Origin: "http://localhost:3200" },
      });
      expect(blockedResponse.status()).toBe(429);
      expect(
        await fixture.api.select<{ id: string }>(
          "abuse_events",
          `tenant_id=eq.${fixture.tenantAId}&event_type=eq.REPEATED_REQUEST&select=id`,
        ),
      ).toHaveLength(1);
      expect(
        await fixture.api.select<{ id: string }>(
          "audit_logs",
          `tenant_id=eq.${fixture.tenantAId}&action=in.(SITE_OFFICE_ALERT_REQUESTED,CONTACT_REPORT_PROCESSED)&select=id`,
        ),
      ).toHaveLength(2);
    });

    test("Phase 9 cleanup, KPI dashboard, and pilot readiness stay scoped and explicit", async ({
      page,
    }) => {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        throw new Error("Privacy cleanup staging authorization is unavailable.");
      }
      const [session] = await fixture.api.select<{ id: string }>(
        "contact_sessions",
        `tenant_id=eq.${fixture.tenantAId}&select=id&order=created_at.asc&limit=1`,
      );
      if (!session) {
        throw new Error("Phase 9 cleanup session fixture is unavailable.");
      }
      const prepared = await fixture.api.rpc<{
        block_id: string;
        message_id: string;
        token_id: string;
      }>("prepare_phase_9_cleanup_staging_fixture", {
        p_session_id: session.id,
        p_tenant_id: fixture.tenantAId,
      });
      expect(prepared).toMatchObject({
        block_id: expect.any(String),
        message_id: expect.any(String),
        token_id: expect.any(String),
      });
      const [messageBefore] = await fixture.api.select<{ body_hash: string }>(
        "messages",
        `id=eq.${prepared.message_id}&select=body_hash`,
      );
      expect(
        (
          await page.request.post("/api/internal/privacy-cleanup", {
            data: { tenantId: fixture.tenantAId },
          })
        ).status(),
      ).toBe(401);
      const cleanupResponse = await internalRequest("/api/internal/privacy-cleanup", cronSecret, {
        body: { tenantId: fixture.tenantAId },
        method: "POST",
      });
      expect(cleanupResponse.status).toBe(200);
      const cleanupPayload = (await cleanupResponse.json()) as {
        data: {
          expiredSessionCount: number;
          redactedMessageCount: number;
          revokedBlockCount: number;
          revokedTokenCount: number;
          status: string;
        };
      };
      expect(cleanupPayload.data).toMatchObject({
        expiredSessionCount: 1,
        redactedMessageCount: 1,
        revokedBlockCount: 1,
        status: "SUCCESS",
      });
      expect(cleanupPayload.data.revokedTokenCount).toBeGreaterThanOrEqual(1);
      const [messageAfter] = await fixture.api.select<{ body: string; body_hash: string }>(
        "messages",
        `id=eq.${prepared.message_id}&select=body,body_hash`,
      );
      expect(messageAfter).toEqual({
        body: "[REDACTED]",
        body_hash: messageBefore?.body_hash,
      });
      const expiredSessionMessages = await fixture.api.select<{
        body: string;
        body_hash: string;
      }>("messages", `session_id=eq.${session.id}&select=body,body_hash`);
      expect(expiredSessionMessages.length).toBeGreaterThan(0);
      expect(
        expiredSessionMessages.every(
          ({ body, body_hash }) => body === "[REDACTED]" && body_hash === "0".repeat(64),
        ),
      ).toBe(true);
      expect(
        await fixture.api.select<{ id: string }>(
          "contact_sessions",
          `id=eq.${session.id}&status=eq.EXPIRED&select=id`,
        ),
      ).toHaveLength(1);
      expect(
        await fixture.api.select<{ id: string }>(
          "response_tokens",
          `id=eq.${prepared.token_id}&revoked_at=not.is.null&select=id`,
        ),
      ).toHaveLength(1);
      expect(
        await fixture.api.select<{ id: string }>(
          "caller_blocks",
          `id=eq.${prepared.block_id}&revoked_at=not.is.null&select=id`,
        ),
      ).toHaveLength(1);

      const idempotencyRequestId = randomUUID();
      const firstIdempotent = await fixture.api.rpc<{ run_id: string; status: string }>(
        "run_privacy_cleanup",
        {
          p_block_grace_hours: 0,
          p_message_retention_hours: 72,
          p_request_id: idempotencyRequestId,
          p_tenant_id: fixture.tenantAId,
          p_token_grace_hours: 0,
        },
      );
      const secondIdempotent = await fixture.api.rpc<{ run_id: string; status: string }>(
        "run_privacy_cleanup",
        {
          p_block_grace_hours: 0,
          p_message_retention_hours: 72,
          p_request_id: idempotencyRequestId,
          p_tenant_id: fixture.tenantAId,
          p_token_grace_hours: 0,
        },
      );
      expect(secondIdempotent).toEqual(firstIdempotent);

      const hour = new Date();
      hour.setUTCMinutes(0, 0, 0);
      await fixture.api.rpc("aggregate_operations_metrics", {
        p_site_id: fixture.sites.companyAFirst.id,
        p_tenant_id: fixture.tenantAId,
        p_window_start: hour.toISOString(),
      });
      expect(
        await fixture.api.select<{ id: string }>(
          "operations_metric_snapshots",
          `tenant_id=eq.${fixture.tenantAId}&site_id=eq.${fixture.sites.companyAFirst.id}&select=id`,
        ),
      ).toHaveLength(1);

      await page.context().clearCookies();
      await signInAndSatisfyMfa(page, fixture.actors.siteAdmin, "ko");
      for (const width of [320, 768, 1280, 1920]) {
        await page.setViewportSize({ height: 900, width });
        const response = await page.goto("/ko/admin/operations");
        expect(response?.status()).toBe(200);
        await expect(
          page.getByRole("heading", {
            name: /오늘의 차량 연락 여정에서 확인이 필요한 운영 신호를 봅니다/u,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(page.getByText("현장 확인이 필요한 점검 항목이 있습니다")).toBeVisible();
      await expect(page.getByText("허용 사이트")).toBeVisible();
      const operationsBody = await (await page.request.get("/ko/admin/operations")).text();
      expect(operationsBody).not.toMatch(
        /destination_hash|anonymous_hash|network_hash|session_token|response_token/iu,
      );
      const pilot = (await authenticatedRpc(
        fixture.actors.siteAdmin,
        "read_pilot_readiness_snapshot",
        {},
      )) as Record<string, unknown>;
      expect(pilot).toMatchObject({
        automated_cleanup_evidence_count: 2,
        automated_dashboard_gate: true,
        manual_physical_print_gate: false,
        manual_real_device_gate: false,
        manual_screen_reader_gate: false,
        site_count: 1,
      });
    });
  });
