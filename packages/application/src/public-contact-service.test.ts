import { describe, expect, it, vi } from "vitest";
import type {
  PublicContactHasher,
  PublicContactRepository,
  PublicContactSecretFactory,
} from "./public-contact-service.js";
import { PublicContactService, PublicContactServiceError } from "./public-contact-service.js";

function createHarness() {
  const repository: PublicContactRepository = {
    create: vi.fn(async () => ({
      callerMessageCount: 1,
      expiresAt: "2026-07-20T03:00:00.000Z",
      merged: false,
      ownerMessages: [],
      reasonCode: "MOVE_REQUEST" as const,
      status: "NOTIFICATION_QUEUED" as const,
      version: 1,
    })),
    inspect: vi.fn(async () => ({
      contactEnabled: true as const,
      qrStatus: "ACTIVE" as const,
      siteDisplayName: "Test Site",
      vehicle: {
        color: null,
        plateLast4: "7098",
        type: null,
      },
    })),
    read: vi.fn(async () => ({
      callerMessageCount: 1,
      expiresAt: "2026-07-20T03:00:00.000Z",
      ownerMessages: [],
      reasonCode: "MOVE_REQUEST" as const,
      status: "NOTIFICATION_QUEUED" as const,
      version: 1,
    })),
  };
  const hasher: PublicContactHasher = {
    hash: vi.fn(async (_value, purpose) => purpose.padEnd(64, "0").slice(0, 64)),
  };
  const secrets: PublicContactSecretFactory = {
    createSessionToken: () => "session_12345678901234567890",
  };
  return {
    hasher,
    repository,
    service: new PublicContactService(repository, hasher, secrets),
  };
}

describe("PublicContactService", () => {
  it("returns only the approved public QR DTO", async () => {
    const { repository, service } = createHarness();
    await expect(service.inspect({ publicToken: "public_token_1234567890" })).resolves.toEqual({
      contactEnabled: true,
      qrStatus: "ACTIVE",
      siteDisplayName: "Test Site",
      vehicle: {
        color: null,
        plateLast4: "7098",
        type: null,
      },
    });
    expect(repository.inspect).toHaveBeenCalledWith({ publicTokenHash: expect.any(String) });
  });

  it("normalizes input and sends only hashes plus bounded message to the repository", async () => {
    const { repository, service } = createHarness();
    await expect(
      service.create({
        anonymousToken: "anonymous_12345678901234567890",
        message: "  차량 이동을  부탁드립니다. ",
        messageMode: "TEMPLATE",
        networkFingerprint: "network",
        plateLast4: "7098",
        publicToken: "public_token_1234567890",
        reasonCode: "MOVE_REQUEST",
        userAgent: "browser",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionToken: "session_12345678901234567890",
        status: "NOTIFICATION_QUEUED",
      }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousTokenHash: expect.any(String),
        message: "차량 이동을 부탁드립니다.",
        messageHash: expect.any(String),
        publicTokenHash: expect.any(String),
        sessionTokenHash: expect.any(String),
      }),
    );
    const persisted = vi.mocked(repository.create).mock.calls[0]?.[0];
    expect(JSON.stringify(persisted)).not.toContain("anonymous_12345678901234567890");
    expect(JSON.stringify(persisted)).not.toContain("public_token_1234567890");
    expect(JSON.stringify(persisted)).not.toContain("session_12345678901234567890");
  });

  it("hashes both recovery tokens before session read", async () => {
    const { repository, service } = createHarness();
    await service.read({
      anonymousToken: "anonymous_12345678901234567890",
      sessionToken: "session_12345678901234567890",
    });
    expect(repository.read).toHaveBeenCalledWith({
      anonymousTokenHash: expect.any(String),
      sessionTokenHash: expect.any(String),
    });
  });

  it("rejects short secrets and oversized fingerprints", async () => {
    const { service } = createHarness();
    await expect(service.inspect({ publicToken: "short" })).rejects.toEqual(
      new PublicContactServiceError("INVALID_SECRET"),
    );
    await expect(
      service.create({
        anonymousToken: "anonymous_12345678901234567890",
        message: "차량 이동을 부탁드립니다.",
        messageMode: "TEMPLATE",
        networkFingerprint: "n".repeat(501),
        plateLast4: "7098",
        publicToken: "public_token_1234567890",
        reasonCode: "MOVE_REQUEST",
        userAgent: "browser",
      }),
    ).rejects.toEqual(new PublicContactServiceError("INVALID_FINGERPRINT"));
  });
});
