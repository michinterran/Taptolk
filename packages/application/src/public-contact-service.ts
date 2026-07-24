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
  callerMessage?: string;
  callerMessageCount: number;
  createdAt?: string;
  expiresAt: string;
  ownerMessages: readonly PublicContactOwnerMessage[];
  reasonCode: ContactReasonCode;
  status: PublicContactStatus;
  vehiclePlateLast4?: string;
  version: number;
}

export interface PublicContactOwnerMessage {
  body: string;
  createdAt: string;
  replyCode: string | null;
}

export interface PublicContactEscalationState {
  elapsedSeconds: number;
  officeAvailable: boolean;
  stage: "OFFICE_AVAILABLE" | "REMINDER" | "WAITING";
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

export interface PublicContactCaptchaVerifier {
  verify(input: {
    anonymousTokenHash: string;
    captchaToken?: string;
    networkHash: string;
  }): Promise<boolean>;
}

const allowPublicContactCaptcha: PublicContactCaptchaVerifier = {
  async verify() {
    return true;
  },
};

export interface PublicContactRepository {
  create(input: PublicContactRepositoryCreateInput): Promise<PublicContactRepositoryCreateResult>;
  inspect(input: { publicTokenHash: string }): Promise<PublicQrContactInspection>;
  escalation(input: {
    anonymousTokenHash: string;
    sessionTokenHash: string;
  }): Promise<PublicContactEscalationState>;
  officeAlert(input: {
    anonymousTokenHash: string;
    sessionTokenHash: string;
  }): Promise<{ status: "ESCALATED" }>;
  read(input: {
    anonymousTokenHash: string;
    sessionTokenHash: string;
  }): Promise<PublicContactSessionReadModel>;
  recordAbuse(input: {
    anonymousTokenHash: string;
    eventType: "CAPTCHA_FAILED";
    networkHash: string;
    publicTokenHash: string;
    reasonCode: string;
  }): Promise<void>;
  report(input: {
    anonymousTokenHash: string;
    reasonCode: string;
    sessionTokenHash: string;
  }): Promise<{ reportId: string; status: "OPEN" }>;
  resolve(input: {
    anonymousTokenHash: string;
    sessionTokenHash: string;
  }): Promise<{ status: "RESOLVED" }>;
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
    private readonly captcha: PublicContactCaptchaVerifier = allowPublicContactCaptcha,
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
    captchaToken?: string;
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
    const networkHash = await this.hashFingerprint(input.networkFingerprint, "network");
    const publicTokenHash = await this.hashOpaque(input.publicToken, "public-token");
    if (
      !(await this.captcha.verify({
        anonymousTokenHash,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
        networkHash,
      }))
    ) {
      await this.repository.recordAbuse({
        anonymousTokenHash,
        eventType: "CAPTCHA_FAILED",
        networkHash,
        publicTokenHash,
        reasonCode: "CAPTCHA_VERIFICATION_FAILED",
      });
      throw new PublicContactServiceError("CAPTCHA_REQUIRED");
    }
    const result = await this.repository.create({
      anonymousTokenHash,
      idempotencyKey: await this.hasher.hash(
        `${anonymousTokenHash}:${sessionTokenHash}:${reasonCode}`,
        "idempotency",
      ),
      message,
      messageHash,
      messageMode: input.messageMode,
      networkHash,
      plateLast4: input.plateLast4,
      policy: this.policy,
      publicTokenHash,
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

  async escalation(input: {
    anonymousToken: string;
    sessionToken: string;
  }): Promise<PublicContactEscalationState> {
    return this.repository.escalation(await this.recoveryHashes(input));
  }

  async officeAlert(input: {
    anonymousToken: string;
    sessionToken: string;
  }): Promise<{ status: "ESCALATED" }> {
    return this.repository.officeAlert(await this.recoveryHashes(input));
  }

  async report(input: {
    anonymousToken: string;
    reasonCode: string;
    sessionToken: string;
  }): Promise<{ reportId: string; status: "OPEN" }> {
    const reasonCode = input.reasonCode.trim();
    if (reasonCode.length < 3 || reasonCode.length > 64) {
      throw new PublicContactServiceError("INVALID_REPORT");
    }
    return this.repository.report({
      ...(await this.recoveryHashes(input)),
      reasonCode,
    });
  }

  async resolve(input: {
    anonymousToken: string;
    sessionToken: string;
  }): Promise<{ status: "RESOLVED" }> {
    return this.repository.resolve(await this.recoveryHashes(input));
  }

  private async recoveryHashes(input: {
    anonymousToken: string;
    sessionToken: string;
  }): Promise<{ anonymousTokenHash: string; sessionTokenHash: string }> {
    return {
      anonymousTokenHash: await this.hashOpaque(input.anonymousToken, "anonymous-token"),
      sessionTokenHash: await this.hashOpaque(input.sessionToken, "session-token"),
    };
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
  constructor(
    readonly code: "CAPTCHA_REQUIRED" | "INVALID_FINGERPRINT" | "INVALID_REPORT" | "INVALID_SECRET",
  ) {
    super(`Public contact service rejected: ${code}`);
    this.name = "PublicContactServiceError";
  }
}
