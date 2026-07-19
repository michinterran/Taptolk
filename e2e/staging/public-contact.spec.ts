import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  createStagingFixture,
  loadStagingEnvironment,
  type StagingFixture,
} from "./staging-fixture";

interface PublicContactFixture {
  assetId: string;
  ownerId: string;
  publicToken: string;
  publicTokenHash: string;
}

let fixture: StagingFixture;
let contactFixture: PublicContactFixture;
let contractId: string;

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
      for (const width of [320, 768, 1280, 1920]) {
        await page.setViewportSize({ height: 900, width });
        await page.goto(`/en/q/${encodeURIComponent(contactFixture.publicToken)}`);
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
      await page.locator("body").press("Tab");
      await expect(page.getByRole("button", { name: "이 차량이 맞습니다" })).toBeFocused();
      await expect(page.getByText("•••• 7098")).toBeVisible();
      await page.getByRole("button", { name: "이 차량이 맞습니다" }).click();
      await page.getByRole("button", { name: "차량 이동" }).click();
      await expect(page.getByText("차량 이동을 부탁드립니다.")).toBeVisible();

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
        fixture.api.select<{ id: string; status: string }>(
          "notification_deliveries",
          `tenant_id=eq.${fixture.tenantAId}&select=id,status`,
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
      expect(deliveries).toEqual([expect.objectContaining({ status: "QUEUED" })]);
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
      request,
    }) => {
      const workerSecret = process.env.QUEUE_WORKER_SECRET;
      if (!workerSecret) {
        throw new Error("Notification Worker staging authorization is unavailable.");
      }
      const headers = { Authorization: `Bearer ${workerSecret}` };
      expect(
        (await request.delete("/api/internal/notification-staging", { headers })).status(),
      ).toBe(200);
      expect(
        (
          await request.post("/api/internal/notification-staging", {
            data: { failureCode: "TEMPORARY_FAILURE" },
            headers,
          })
        ).status(),
      ).toBe(200);
      const firstDispatch = await request.post("/api/internal/notification-dispatch", { headers });
      expect(firstDispatch.status()).toBe(200);
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
        (await request.post("/api/internal/notification-dispatch", { headers })).status(),
      ).toBe(200);

      const firstInbox = (await (
        await request.get("/api/internal/notification-staging", { headers })
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
      }>(
        "notification_deliveries",
        `tenant_id=eq.${fixture.tenantAId}&status=eq.QUEUED&select=id,idempotency_key&order=created_at.desc&limit=1`,
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
      const recoveredDispatch = await request.post("/api/internal/notification-dispatch", {
        headers,
      });
      expect(await recoveredDispatch.json()).toMatchObject({
        data: { claimed: 1, failedFinal: 0, sent: 1 },
      });
      expect(
        (await request.post("/api/internal/notification-dispatch", { headers })).status(),
      ).toBe(200);

      const inbox = (await (
        await request.get("/api/internal/notification-staging", { headers })
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
      expect(
        await fixture.api.select<{ id: string }>(
          "notification_deliveries",
          `tenant_id=eq.${fixture.tenantAId}&status=eq.PROCESSING&select=id`,
        ),
      ).toEqual([]);
    });
  });
