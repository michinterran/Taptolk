import { describe, expect, it, vi } from "vitest";
import type {
  OwnerActivationProtector,
  OwnerActivationRepository,
  OwnerActivationSecretFactory,
  OwnerOtpProvider,
} from "./owner-activation-service.js";
import { OwnerActivationService, OwnerActivationServiceError } from "./owner-activation-service.js";

const challengeId = "00000000-0000-4000-8000-000000000001";

function createHarness() {
  const repository: OwnerActivationRepository = {
    complete: vi.fn(async () => ({
      ownerId: "00000000-0000-4000-8000-000000000002",
      qrStatus: "ACTIVE" as const,
      sessionExpiresAt: "2026-07-20T12:00:00.000Z",
      vehicleId: "00000000-0000-4000-8000-000000000003",
      vehiclePlateLast4: "3456",
    })),
    inspect: vi.fn(async () => ({
      activatable: true,
      assignmentMode: "SELF_REGISTRATION" as const,
      plateLast4: null,
      qrStatus: "IN_STOCK" as const,
      siteDisplayName: "Test Site",
    })),
    listVehicles: vi.fn(async () => [
      {
        plateLast4: "3456",
        qrStatus: "ACTIVE" as const,
        siteDisplayName: "Test Site",
        siteId: "00000000-0000-4000-8000-000000000004",
        vehicleId: "00000000-0000-4000-8000-000000000003",
      },
    ]),
    listHistory: vi.fn(async () => [
      {
        createdAt: "2026-07-20T00:00:00.000Z",
        reasonCode: "MOVE_REQUEST",
        responseSeconds: 75,
        result: "ANSWERED" as const,
        sessionId: "00000000-0000-4000-8000-000000000005",
      },
    ]),
    listMessages: vi.fn(async () => [
      {
        callerMessage: "출차 부탁드립니다.",
        createdAt: "2026-07-20T00:00:00.000Z",
        reasonCode: "MOVE_REQUEST",
        sessionId: "00000000-0000-4000-8000-000000000005",
        status: "OWNER_NOTIFIED",
        vehiclePlateLast4: "3456",
      },
    ]),
    markOtpDelivery: vi.fn(async () => undefined),
    pushState: vi.fn(async () => ({ subscribed: false })),
    revokePushSubscription: vi.fn(async () => ({ subscribed: false })),
    savePushSubscription: vi.fn(async () => ({ subscribed: true })),
    requestOtp: vi.fn(async () => ({
      challengeId,
      expiresAt: "2026-07-20T00:03:00.000Z",
      resendAfter: "2026-07-20T00:01:00.000Z",
    })),
    requestReclaimOtp: vi.fn(async () => ({
      challengeId,
      expiresAt: "2026-07-20T00:03:00.000Z",
      resendAfter: "2026-07-20T00:01:00.000Z",
    })),
    verifyReclaimOtp: vi.fn(async () => ({
      sessionExpiresAt: "2026-07-20T12:00:00.000Z",
    })),
    verifyOtp: vi.fn(async () => ({
      expiresAt: "2026-07-20T00:05:00.000Z",
      verified: true as const,
    })),
  };
  const protector: OwnerActivationProtector = {
    hash: vi.fn(async (_value, purpose) => `${purpose.padEnd(64, "0").slice(0, 64)}`),
    protect: vi.fn(async (value) => ({
      ciphertext: `v1.ciphertext.${value.length}`,
      keyVersion: 1,
      last4: value.slice(-4),
      lookupHash: "a".repeat(64),
    })),
  };
  const secrets: OwnerActivationSecretFactory = {
    createOtp: () => "123456",
    createProof: () => "proof_12345678901234567890",
    createSession: () => "session_12345678901234567890",
  };
  const provider: OwnerOtpProvider = {
    send: vi.fn(async () => undefined),
  };
  return {
    provider,
    repository,
    service: new OwnerActivationService(repository, protector, secrets, provider),
  };
}

describe("OwnerActivationService", () => {
  it("keeps raw OTP at the provider boundary and stores hashes only", async () => {
    const { provider, repository, service } = createHarness();
    await service.requestOtp({
      deviceHash: "d".repeat(64),
      locale: "ko",
      networkFingerprint: "1",
      phone: "010-1234-5678",
      publicToken: "public_token_1234567890",
    });

    expect(repository.requestOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        otpHash: expect.any(String),
        phone: expect.objectContaining({ lookupHash: "a".repeat(64) }),
      }),
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ otp: "123456", phone: "01012345678" }),
    );
    expect(repository.markOtpDelivery).toHaveBeenCalledWith({
      challengeId,
      status: "SENT",
    });
  });

  it("returns a raw proof only after the repository verifies the hashed OTP", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.verifyOtp({
        challengeId,
        otp: "123456",
        publicToken: "public_token_1234567890",
      }),
    ).resolves.toEqual({
      expiresAt: "2026-07-20T00:05:00.000Z",
      proof: "proof_12345678901234567890",
      verified: true,
    });
    expect(repository.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId,
        otpHash: expect.any(String),
        proofHash: expect.any(String),
      }),
    );
  });

  it("returns the raw session only after atomic completion", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.complete({
        consentAccepted: true,
        deviceHash: "d".repeat(64),
        plate: "12가 3456",
        privacyVersion: "PRIVACY_V1",
        proof: "proof_12345678901234567890",
        publicToken: "public_token_1234567890",
        termsVersion: "TERMS_V1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        qrStatus: "ACTIVE",
        sessionToken: "session_12345678901234567890",
      }),
    );
    expect(repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHash: expect.any(String),
      }),
    );
  });

  it("requests reclaim OTP with hashed plate lookup and protected phone only", async () => {
    const { provider, repository, service } = createHarness();
    await service.requestReclaimOtp({
      deviceHash: "d".repeat(64),
      locale: "ko",
      networkFingerprint: "1",
      phone: "010-1234-5678",
      plate: "12가 3456",
      publicToken: "public_token_1234567890",
    });

    expect(repository.requestReclaimOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        otpHash: expect.any(String),
        phone: expect.objectContaining({ lookupHash: "a".repeat(64) }),
        plateLookupHash: "vehicle-plate".padEnd(64, "0").slice(0, 64),
      }),
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ otp: "123456", phone: "01012345678" }),
    );
  });

  it("creates a reclaim session through the repository without returning phone data", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.verifyReclaimOtp({
        challengeId,
        deviceHash: "d".repeat(64),
        otp: "123456",
        publicToken: "public_token_1234567890",
      }),
    ).resolves.toEqual({
      sessionExpiresAt: "2026-07-20T12:00:00.000Z",
      sessionToken: "session_12345678901234567890",
    });
    expect(repository.verifyReclaimOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId,
        deviceHash: "d".repeat(64),
        otpHash: expect.any(String),
        sessionHash: expect.any(String),
      }),
    );
  });

  it("marks a challenge failed when delivery fails without exposing provider detail", async () => {
    const harness = createHarness();
    vi.mocked(harness.provider.send).mockRejectedValueOnce(new Error("provider secret detail"));
    await expect(
      harness.service.requestOtp({
        deviceHash: "d".repeat(64),
        locale: "en",
        networkFingerprint: "1",
        phone: "01012345678",
        publicToken: "public_token_1234567890",
      }),
    ).rejects.toEqual(new OwnerActivationServiceError("OTP_DELIVERY_FAILED"));
    expect(harness.repository.markOtpDelivery).toHaveBeenCalledWith({
      challengeId,
      status: "FAILED",
    });
  });

  it("hashes the HttpOnly session token before reading Owner vehicles", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.listVehicles({
        deviceHash: "d".repeat(64),
        sessionToken: "session_12345678901234567890",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        plateLast4: "3456",
        qrStatus: "ACTIVE",
      }),
    ]);
    expect(repository.listVehicles).toHaveBeenCalledWith({
      deviceHash: "d".repeat(64),
      sessionHash: expect.any(String),
    });
  });

  it("hashes the HttpOnly session token before reading Owner messages and history", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.listMessages({
        deviceHash: "d".repeat(64),
        sessionToken: "session_12345678901234567890",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        callerMessage: "출차 부탁드립니다.",
        vehiclePlateLast4: "3456",
      }),
    ]);
    await expect(
      service.listHistory({
        deviceHash: "d".repeat(64),
        sessionToken: "session_12345678901234567890",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        responseSeconds: 75,
        result: "ANSWERED",
      }),
    ]);
    expect(repository.listMessages).toHaveBeenCalledWith({
      deviceHash: "d".repeat(64),
      sessionHash: expect.any(String),
    });
    expect(repository.listHistory).toHaveBeenCalledWith({
      deviceHash: "d".repeat(64),
      sessionHash: expect.any(String),
    });
  });

  it("stores only a hashed push endpoint lookup through the repository", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.savePushSubscription({
        deviceHash: "d".repeat(64),
        sessionToken: "session_12345678901234567890",
        subscription: {
          endpoint: "https://push.example.test/send/abcdef1234567890",
          expirationTime: null,
          keys: {
            auth: "auth-secret",
            p256dh: "p256dh-public-key-material",
          },
        },
      }),
    ).resolves.toEqual({ subscribed: true });
    expect(repository.savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointHash: "push-endpoint".padEnd(64, "0").slice(0, 64),
      }),
    );
  });
});
