import {
  assertContactPlateLast4,
  assertPublicContactRatePolicy,
  type ContactMessageMode,
  type ContactReasonCode,
  DEFAULT_PUBLIC_CONTACT_RATE_POLICY,
  normalizeContactMessage,
  normalizeContactReason,
  type PublicContactRatePolicy,
  type PublicContactStatus,
} from "@taptolk/domain";

export interface PublicQrContactInspection {
  contactEnabled: true;
  qrStatus: "ACTIVE";
  siteDisplayName: string;
  vehicle: {
    color: string | null;
    plateLast4: string;
    type: string | null;
  };
}

export interface PublicContactSessionReadModel {
  callerMessageCount: number;
  expiresAt: string;
  ownerMessages: readonly PublicContactOwnerMessage[];
  reasonCode: ContactReasonCode;
  status: PublicContactStatus;
  version: number;
}

export interface PublicContactOwnerMessage {
  body: string;
  createdAt: string;
  replyCode: string | null;
}

export interface PublicContactCreationResult extends PublicContactSessionReadModel {
  merged: boolean;
  sessionToken: string;
}

export type PublicContactHashPurpose =
  | "anonymous-token"
  | "idempotency"
  | "message"
  | "network"
  | "public-token"
  | "session-token"
  | "user-agent";

export interface PublicContactHasher {
  hash(value: string, purpose: PublicContactHashPurpose): Promise<string>;
}

export interface PublicContactSecretFactory {
  createSessionToken(): string;
}

export interface PublicContactRepository {
  create(input: PublicContactRepositoryCreateInput): Promise<PublicContactRepositoryCreateResult>;
  inspect(input: { publicTokenHash: string }): Promise<PublicQrContactInspection>;
  read(input: {
    anonymousTokenHash: string;
    sessionTokenHash: string;
  }): Promise<PublicContactSessionReadModel>;
}

export interface PublicContactRepositoryCreateInput {
  anonymousTokenHash: string;
  idempotencyKey: string;
  message: string;
  messageHash: string;
  messageMode: ContactMessageMode;
  networkHash: string;
  plateLast4: string;
  policy: PublicContactRatePolicy;
  publicTokenHash: string;
  reasonCode: ContactReasonCode;
  sessionTokenHash: string;
  userAgentHash: string;
}

export interface PublicContactRepositoryCreateResult extends PublicContactSessionReadModel {
  merged: boolean;
}

export class PublicContactService {
  private readonly policy: PublicContactRatePolicy;

  constructor(
    private readonly repository: PublicContactRepository,
    private readonly hasher: PublicContactHasher,
    private readonly secrets: PublicContactSecretFactory,
    policy: PublicContactRatePolicy = DEFAULT_PUBLIC_CONTACT_RATE_POLICY,
  ) {
    assertPublicContactRatePolicy(policy);
    this.policy = Object.freeze({ ...policy });
  }

  async inspect(input: { publicToken: string }): Promise<PublicQrContactInspection> {
    return this.repository.inspect({
      publicTokenHash: await this.hashOpaque(input.publicToken, "public-token"),
    });
  }

  async create(input: {
    anonymousToken: string;
    existingSessionToken?: string;
    message: string;
    messageMode: ContactMessageMode;
    networkFingerprint: string;
    plateLast4: string;
    publicToken: string;
    reasonCode: string;
    userAgent: string;
  }): Promise<PublicContactCreationResult> {
    assertContactPlateLast4(input.plateLast4);
    const reasonCode = normalizeContactReason(input.reasonCode);
    const message = normalizeContactMessage({
      mode: input.messageMode,
      value: input.message,
    });
    const sessionToken = this.requireOpaque(
      input.existingSessionToken ?? this.secrets.createSessionToken(),
    );
    const sessionTokenHash = await this.hasher.hash(sessionToken, "session-token");
    const anonymousTokenHash = await this.hashOpaque(input.anonymousToken, "anonymous-token");
    const messageHash = await this.hasher.hash(message, "message");
    const result = await this.repository.create({
      anonymousTokenHash,
      idempotencyKey: await this.hasher.hash(
        `${anonymousTokenHash}:${sessionTokenHash}:${reasonCode}`,
        "idempotency",
      ),
      message,
      messageHash,
      messageMode: input.messageMode,
      networkHash: await this.hashFingerprint(input.networkFingerprint, "network"),
      plateLast4: input.plateLast4,
      policy: this.policy,
      publicTokenHash: await this.hashOpaque(input.publicToken, "public-token"),
      reasonCode,
      sessionTokenHash,
      userAgentHash: await this.hashFingerprint(input.userAgent, "user-agent"),
    });
    return { ...result, sessionToken };
  }

  async read(input: {
    anonymousToken: string;
    sessionToken: string;
  }): Promise<PublicContactSessionReadModel> {
    return this.repository.read({
      anonymousTokenHash: await this.hashOpaque(input.anonymousToken, "anonymous-token"),
      sessionTokenHash: await this.hashOpaque(input.sessionToken, "session-token"),
    });
  }

  private async hashOpaque(
    value: string,
    purpose: Extract<
      PublicContactHashPurpose,
      "anonymous-token" | "public-token" | "session-token"
    >,
  ): Promise<string> {
    return this.hasher.hash(this.requireOpaque(value), purpose);
  }

  private async hashFingerprint(
    value: string,
    purpose: Extract<PublicContactHashPurpose, "network" | "user-agent">,
  ): Promise<string> {
    if (value.length < 1 || value.length > 500) {
      throw new PublicContactServiceError("INVALID_FINGERPRINT");
    }
    return this.hasher.hash(value, purpose);
  }

  private requireOpaque(value: string): string {
    if (value.length < 16 || value.length > 500) {
      throw new PublicContactServiceError("INVALID_SECRET");
    }
    return value;
  }
}

export class PublicContactServiceError extends Error {
  constructor(readonly code: "INVALID_FINGERPRINT" | "INVALID_SECRET") {
    super(`Public contact service rejected: ${code}`);
    this.name = "PublicContactServiceError";
  }
}
