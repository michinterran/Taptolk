import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  auditPayloadIsSafe,
  createStagingFixture,
  loadStagingEnvironment,
  type StagingFixture,
} from "./staging-fixture";

interface OwnerFixture {
  activationCode: string;
  assetId: string;
  publicToken: string;
  publicTokenHash: string;
  siteId: string;
}

interface ActivationData {
  ownerId: string;
  qrStatus: "ACTIVE";
  vehicleId: string;
  vehiclePlateLast4: string;
}

let fixture: StagingFixture;
let uiFixture: OwnerFixture;
let raceFixture: OwnerFixture;
const ownerIds = new Set<string>();

function ownerHmac(value: string, purpose: string): string {
  const rootSecret = process.env.TOKEN_HMAC_KEY;
  if (!rootSecret) {
    throw new Error("Owner staging HMAC configuration is unavailable.");
  }
  const rootKey = createHash("sha256").update(`owner-hmac-root\0${rootSecret}`, "utf8").digest();
  const purposeKey = createHmac("sha256", rootKey).update(`owner-${purpose}`, "utf8").digest();
  return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
}

function randomDeviceHash(): string {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}

async function provisionOwnerFixture(siteId: string, label: string): Promise<OwnerFixture> {
  const publicToken = randomBytes(32).toString("base64url");
  const activationCode = `ABCD${randomBytes(4).toString("hex").toUpperCase()}`;
  const publicTokenHash = ownerHmac(publicToken, "public-token");
  const result = await fixture.api.rpc<{ asset_id: string }>(
    "provision_owner_activation_staging_fixture",
    {
      p_activation_code_hash: ownerHmac(activationCode, "activation-code"),
      p_approver_id: fixture.actors.superAdmin.id,
      p_fixture_label: label,
      p_management_company_id: fixture.companyAId,
      p_public_token_hash: publicTokenHash,
      p_requester_id: fixture.actors.siteAdmin.id,
      p_site_id: siteId,
      p_tenant_id: fixture.tenantAId,
    },
  );
  return {
    activationCode,
    assetId: result.asset_id,
    publicToken,
    publicTokenHash,
    siteId,
  };
}

async function postOwner(request: APIRequestContext, path: string, data: Record<string, unknown>) {
  return request.post(path, {
    data,
    headers: { Origin: "http://localhost:3200" },
  });
}

test.describe
  .serial("Owner activation staging acceptance", () => {
    test.beforeAll(async () => {
      loadStagingEnvironment();
      fixture = await createStagingFixture();
      await fixture.api.insert("admin_memberships", [
        {
          accepted_at: new Date().toISOString(),
          id: randomUUID(),
          management_company_id: fixture.companyAId,
          role: "SITE_ADMIN",
          scope_type: "SITE",
          site_id: fixture.sites.companyASecond.id,
          status: "ACTIVE",
          tenant_id: fixture.tenantAId,
          user_id: fixture.actors.siteAdmin.id,
        },
      ]);
      const suffix = randomBytes(5).toString("hex").toUpperCase();
      uiFixture = await provisionOwnerFixture(fixture.sites.companyAFirst.id, `OA-A${suffix}`);
      raceFixture = await provisionOwnerFixture(fixture.sites.companyASecond.id, `OA-B${suffix}`);
    });

    test.afterAll(async () => {
      for (const ownerFixture of [uiFixture, raceFixture]) {
        if (ownerFixture) {
          await fixture.api.rpc("cleanup_owner_activation_staging_fixture", {
            p_public_token_hash: ownerFixture.publicTokenHash,
            p_tenant_id: fixture.tenantAId,
          });
        }
      }
      await fixture?.cleanup();
      for (const actor of Object.values(fixture.actors)) {
        expect(await fixture.api.authUserExists(actor.id)).toBe(false);
      }
      for (const ownerId of ownerIds) {
        expect(
          await fixture.api.select<{ id: string }>(
            "owners",
            `id=eq.${encodeURIComponent(ownerId)}&select=id`,
          ),
        ).toEqual([]);
      }
    });

    test("KO Owner completes the actual QR, phone OTP, consent, and cookie journey", async ({
      page,
    }) => {
      const otp = process.env.OWNER_STAGING_MOCK_OTP;
      if (!otp) {
        throw new Error("Owner staging OTP configuration is unavailable.");
      }
      for (const width of [320, 768, 1280, 1920]) {
        await page.setViewportSize({ height: 900, width });
        await page.goto(`/en/activate/${encodeURIComponent(uiFixture.publicToken)}`);
        await expect(
          page.getByRole("heading", {
            name: /Activate your vehicle QR with a secure verification/u,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
      await page.goto(`/ko/activate/${encodeURIComponent(uiFixture.publicToken)}`);
      await expect(
        page.getByRole("heading", { name: /차량 QR을 안전하게 활성화합니다/u }),
      ).toBeVisible();
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("활성화 코드")).toBeFocused();
      await page.getByLabel("활성화 코드").fill(uiFixture.activationCode);
      await page.getByLabel("차량번호").fill("12가3456");
      await page.getByLabel("휴대전화 번호").fill("01012345678");
      const otpRequestPromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/owner/activation/request-otp"),
      );
      await page.getByRole("button", { name: "인증번호 받기" }).click();
      const otpRequestResponse = await otpRequestPromise;
      if (otpRequestResponse.status() !== 200) {
        const payload = (await otpRequestResponse.json()) as { error?: { code?: string } };
        const challengeRows = await fixture.api.select<{ id: string }>(
          "owner_otp_challenges",
          `qr_asset_id=eq.${uiFixture.assetId}&select=id`,
        );
        throw new Error(
          `Owner OTP request failed with HTTP ${otpRequestResponse.status()} (${payload.error?.code ?? "UNKNOWN"}; persisted challenges ${challengeRows.length}).`,
        );
      }
      await page.getByLabel("휴대전화 인증번호").fill(otp);
      await page.getByRole("button", { name: "인증번호 확인" }).click();
      await page.getByLabel("이용약관과 개인정보 처리방침에 동의합니다.").check();
      const completionResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/owner/activation/complete") && response.status() === 200,
      );
      await page.getByRole("button", { name: "동의하고 활성화 완료" }).click();
      const completionPayload = (await (await completionResponse).json()) as {
        data: ActivationData;
      };
      ownerIds.add(completionPayload.data.ownerId);
      await expect(
        page.getByRole("heading", { name: "QR 활성화가 완료되었습니다." }),
      ).toBeVisible();
      expect(completionPayload.data).toEqual(
        expect.objectContaining({
          qrStatus: "ACTIVE",
          vehiclePlateLast4: "3456",
        }),
      );
      const ownerCookie = (await page.context().cookies()).find(
        ({ name }) => name === "tt_owner_session",
      );
      expect(ownerCookie).toEqual(
        expect.objectContaining({
          httpOnly: true,
          sameSite: "Lax",
        }),
      );
      await page.getByRole("link", { name: "내 차량 보기" }).click();
      await expect(page).toHaveURL(/\/ko\/owner$/u);
      await expect(page.getByText("•••• 3456")).toBeVisible();
    });

    test("two concurrent completes produce one success and one conflict without duplicate rows", async ({
      request,
    }) => {
      const otp = process.env.OWNER_STAGING_MOCK_OTP;
      if (!otp) {
        throw new Error("Owner staging OTP configuration is unavailable.");
      }
      const deviceHash = randomDeviceHash();
      const base = {
        deviceHash,
        locale: "en",
        publicToken: raceFixture.publicToken,
      };
      const requestResponse = await postOwner(request, "/api/owner/activation/request-otp", {
        ...base,
        phone: "01087654321",
      });
      expect(requestResponse.status()).toBe(200);
      const requestPayload = (await requestResponse.json()) as {
        data: { challengeId: string };
      };
      const verifyResponse = await postOwner(request, "/api/owner/activation/verify-otp", {
        challengeId: requestPayload.data.challengeId,
        locale: "en",
        otp,
        publicToken: raceFixture.publicToken,
      });
      expect(verifyResponse.status()).toBe(200);
      const verifyPayload = (await verifyResponse.json()) as { data: { proof: string } };
      const completion = {
        activationCode: raceFixture.activationCode,
        consentAccepted: true,
        deviceHash,
        locale: "en",
        plate: "34나5678",
        privacyVersion: "PRIVACY_V1",
        proof: verifyPayload.data.proof,
        publicToken: raceFixture.publicToken,
        termsVersion: "TERMS_V1",
      };
      const responses = await Promise.all([
        postOwner(request, "/api/owner/activation/complete", completion),
        postOwner(request, "/api/owner/activation/complete", completion),
      ]);
      expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
      const winningResponse = responses.find((response) => response.status() === 200);
      const winningPayload = (await winningResponse?.json()) as { data: ActivationData };
      ownerIds.add(winningPayload.data.ownerId);

      const [assets, codes, bindings, relationships, proofs, audits] = await Promise.all([
        fixture.api.select<{ current_binding_id: string; status: string }>(
          "qr_assets",
          `id=eq.${raceFixture.assetId}&select=status,current_binding_id`,
        ),
        fixture.api.select<{ status: string }>(
          "qr_activation_codes",
          `qr_asset_id=eq.${raceFixture.assetId}&select=status`,
        ),
        fixture.api.select<{ id: string }>(
          "qr_bindings",
          `qr_asset_id=eq.${raceFixture.assetId}&ended_at=is.null&select=id`,
        ),
        fixture.api.select<{ id: string }>(
          "vehicle_owners",
          `site_id=eq.${raceFixture.siteId}&ended_at=is.null&select=id`,
        ),
        fixture.api.select<{ status: string }>(
          "owner_phone_verification_proofs",
          `qr_asset_id=eq.${raceFixture.assetId}&select=status`,
        ),
        fixture.api.select<{
          action: string;
          after_data: unknown;
          before_data: unknown;
        }>(
          "audit_logs",
          `resource_id=eq.${raceFixture.assetId}&select=action,before_data,after_data`,
        ),
      ]);
      expect(assets).toEqual([expect.objectContaining({ status: "ACTIVE" })]);
      expect(codes).toEqual([{ status: "USED" }]);
      expect(bindings).toHaveLength(1);
      expect(relationships).toHaveLength(1);
      expect(proofs).toEqual([{ status: "CONSUMED" }]);
      expect(audits.map(({ action }) => action)).toEqual(["OWNER_QR_ACTIVATED"]);
      expect(auditPayloadIsSafe(audits)).toBe(true);

      const cookies = await request.storageState();
      const sessionCookie = cookies.cookies.find(({ name }) => name === "tt_owner_session");
      expect(sessionCookie).toBeDefined();
      const sessionHash = ownerHmac(sessionCookie?.value ?? "", "session");
      const vehicles = await fixture.api.rpc<unknown[]>("list_owner_vehicles", {
        p_device_hash: deviceHash,
        p_session_hash: sessionHash,
      });
      expect(vehicles).toEqual([
        expect.objectContaining({
          plate_last4: "5678",
          qr_status: "ACTIVE",
        }),
      ]);
      await expect(
        fixture.api.rpc("list_owner_vehicles", {
          p_device_hash: "0".repeat(64),
          p_session_hash: sessionHash,
        }),
      ).rejects.toThrow(/failed with HTTP (?:400|404|500) \(P0002\)/u);
    });
  });
