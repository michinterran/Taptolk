import {
  assertOwnerConsent,
  assertOwnerDeviceId,
  assertOwnerOtpPolicy,
  DEFAULT_OWNER_OTP_POLICY,
  normalizeOwnerOtp,
  normalizeOwnerPhone,
  normalizeOwnerReply,
  normalizeOwnerVehiclePlate,
  type OwnerOtpPolicy,
  type OwnerReplyCode,
} from "@taptolk/domain";

export interface OwnerActivationInspection {
  activatable: boolean;
  assignmentMode: "PREASSIGNED" | "SELF_REGISTRATION";
  plateLast4: string | null;
  qrStatus: "ACTIVATION_PENDING" | "ASSIGNED" | "IN_STOCK";
  siteDisplayName: string;
}

export interface OwnerActivationProtectedValue {
  ciphertext: string;
  keyVersion: number;
  last4: string;
  lookupHash: string;
}

export interface OwnerActivationProtector {
  hash(value: string, purpose: OwnerActivationHashPurpose): Promise<string>;
  protect(
    value: string,
    purpose: "phone" | "vehicle-plate",
  ): Promise<OwnerActivationProtectedValue>;
}

export type OwnerActivationHashPurpose =
  | "activation-code"
  | "network"
  | "otp"
  | "phone"
  | "proof"
  | "push-endpoint"
  | "public-token"
  | "session"
  | "vehicle-plate";

export interface OwnerActivationSecretFactory {
  createOtp(): string;
  createProof(): string;
  createSession(): string;
}

export interface OwnerOtpProvider {
  send(input: {
    challengeId: string;
    locale: "en" | "ko";
    otp: string;
    phone: string;
  }): Promise<void>;
}

export interface OwnerActivationRepository {
  complete(input: {
    consent: {
      privacyVersion: string;
      termsVersion: string;
    };
    deviceHash: string;
    plate: OwnerActivationProtectedValue;
    proofHash: string;
    publicTokenHash: string;
    sessionHash: string;
    sessionTtlSeconds: number;
  }): Promise<OwnerActivationCompletion>;
  inspect(input: { publicTokenHash: string }): Promise<OwnerActivationInspection>;
  listVehicles(input: {
    deviceHash: string;
    sessionHash: string;
  }): Promise<readonly OwnerVehicleItem[]>;
  updateStickerState(input: {
    action: OwnerStickerAction;
    deviceHash: string;
    sessionHash: string;
    vehicleId: string;
  }): Promise<OwnerStickerStateUpdate>;
  listMessages(input: {
    deviceHash: string;
    sessionHash: string;
  }): Promise<readonly OwnerContactMessageItem[]>;
  readMessage(input: {
    deviceHash: string;
    sessionHash: string;
    sessionId: string;
  }): Promise<OwnerContactMessageItem>;
  replyToMessage(input: {
    body: string | null;
    deviceHash: string;
    replyCode: OwnerReplyCode;
    sessionHash: string;
    sessionId: string;
  }): Promise<{ status: "OWNER_REPLIED" }>;
  listHistory(input: {
    deviceHash: string;
    sessionHash: string;
  }): Promise<readonly OwnerContactHistoryItem[]>;
  markOtpDelivery(input: { challengeId: string; status: "FAILED" | "SENT" }): Promise<void>;
  pushState(input: {
    deviceHash: string;
    sessionHash: string;
  }): Promise<OwnerPushSubscriptionState>;
  savePushSubscription(input: {
    deviceHash: string;
    endpointHash: string;
    sessionHash: string;
    subscription: OwnerPushSubscriptionPayload;
  }): Promise<OwnerPushSubscriptionState>;
  revokePushSubscription(input: {
    deviceHash: string;
    endpointHash: string;
    sessionHash: string;
  }): Promise<OwnerPushSubscriptionState>;
  requestOtp(input: {
    deviceHash: string;
    networkHash: string;
    otpHash: string;
    phone: OwnerActivationProtectedValue;
    policy: OwnerOtpPolicy;
    publicTokenHash: string;
  }): Promise<OwnerOtpRequestResult>;
  requestReclaimOtp(input: {
    deviceHash: string;
    networkHash: string;
    otpHash: string;
    phone: OwnerActivationProtectedValue;
    plateLookupHash: string;
    policy: OwnerOtpPolicy;
    publicTokenHash: string;
  }): Promise<OwnerOtpRequestResult>;
  verifyReclaimOtp(input: {
    challengeId: string;
    deviceHash: string;
    otpHash: string;
    publicTokenHash: string;
    sessionHash: string;
    sessionTtlSeconds: number;
  }): Promise<OwnerReclaimVerificationResult>;
  verifyOtp(input: {
    challengeId: string;
    otpHash: string;
    proofHash: string;
    proofTtlSeconds: number;
    publicTokenHash: string;
  }): Promise<OwnerOtpVerificationResult>;
}

export interface OwnerOtpRequestResult {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
}

export interface OwnerOtpVerificationResult {
  expiresAt: string;
  verified: true;
}

export interface OwnerReclaimVerificationResult {
  sessionExpiresAt: string;
}

export interface OwnerActivationCompletion {
  ownerId: string;
  qrStatus: "ACTIVE";
  sessionExpiresAt: string;
  vehicleId: string;
  vehiclePlateLast4: string;
}

export interface OwnerVehicleItem {
  plateLast4: string;
  qrStatus: "ACTIVE" | "SUSPENDED";
  siteDisplayName?: string;
  siteId: string;
  vehicleId: string;
}

export type OwnerStickerAction = "RELEASE" | "RESUME" | "SUSPEND";

export interface OwnerStickerStateUpdate {
  qrStatus: "ACTIVATION_PENDING" | "ACTIVE" | "SUSPENDED";
  vehicleId: string;
}

export interface OwnerContactMessageItem {
  callerMessage: string;
  createdAt: string;
  reasonCode: string;
  replyAvailable?: boolean;
  sessionId: string;
  status: string;
  vehiclePlateLast4: string;
}

export interface OwnerContactHistoryItem {
  createdAt: string;
  reasonCode: string;
  responseSeconds: number | null;
  result: "ANSWERED" | "UNANSWERED";
  sessionId: string;
}

export interface OwnerPushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface OwnerPushSubscriptionState {
  subscribed: boolean;
}

export interface OwnerActivationSessionCompletion extends OwnerActivationCompletion {
  sessionToken: string;
}

export interface OwnerOtpVerification extends OwnerOtpVerificationResult {
  proof: string;
}

export interface OwnerReclaimSession extends OwnerReclaimVerificationResult {
  sessionToken: string;
}

export class OwnerActivationService {
  private readonly policy: OwnerOtpPolicy;

  constructor(
    private readonly repository: OwnerActivationRepository,
    private readonly protector: OwnerActivationProtector,
    private readonly secrets: OwnerActivationSecretFactory,
    private readonly otpProvider: OwnerOtpProvider,
    policy: OwnerOtpPolicy = DEFAULT_OWNER_OTP_POLICY,
  ) {
    assertOwnerOtpPolicy(policy);
    this.policy = Object.freeze({ ...policy });
  }

  async inspect(input: { publicToken: string }): Promise<OwnerActivationInspection> {
    return this.repository.inspect({
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
    });
  }

  async listVehicles(input: {
    deviceHash: string;
    sessionToken: string;
  }): Promise<readonly OwnerVehicleItem[]> {
    assertOwnerDeviceId(input.deviceHash);
    return this.repository.listVehicles({
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
    });
  }

  async updateStickerState(input: {
    action: OwnerStickerAction;
    deviceHash: string;
    sessionToken: string;
    vehicleId: string;
  }): Promise<OwnerStickerStateUpdate> {
    assertOwnerDeviceId(input.deviceHash);
    assertUuid(input.vehicleId);
    if (input.action !== "RELEASE" && input.action !== "RESUME" && input.action !== "SUSPEND") {
      throw new OwnerActivationServiceError("INVALID_ID");
    }
    return this.repository.updateStickerState({
      action: input.action,
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
      vehicleId: input.vehicleId,
    });
  }

  async listMessages(input: {
    deviceHash: string;
    sessionToken: string;
  }): Promise<readonly OwnerContactMessageItem[]> {
    assertOwnerDeviceId(input.deviceHash);
    return this.repository.listMessages({
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
    });
  }

  async readMessage(input: {
    deviceHash: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<OwnerContactMessageItem> {
    assertOwnerDeviceId(input.deviceHash);
    assertUuid(input.sessionId);
    return this.repository.readMessage({
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
      sessionId: input.sessionId,
    });
  }

  async replyToMessage(input: {
    body?: string;
    code: string;
    deviceHash: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<{ status: "OWNER_REPLIED" }> {
    assertOwnerDeviceId(input.deviceHash);
    assertUuid(input.sessionId);
    const reply = normalizeOwnerReply({
      ...(input.body === undefined ? {} : { body: input.body }),
      code: input.code,
    });
    return this.repository.replyToMessage({
      body: reply.body,
      deviceHash: input.deviceHash,
      replyCode: reply.code,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
      sessionId: input.sessionId,
    });
  }

  async listHistory(input: {
    deviceHash: string;
    sessionToken: string;
  }): Promise<readonly OwnerContactHistoryItem[]> {
    assertOwnerDeviceId(input.deviceHash);
    return this.repository.listHistory({
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
    });
  }

  async pushState(input: {
    deviceHash: string;
    sessionToken: string;
  }): Promise<OwnerPushSubscriptionState> {
    assertOwnerDeviceId(input.deviceHash);
    return this.repository.pushState({
      deviceHash: input.deviceHash,
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
    });
  }

  async savePushSubscription(input: {
    deviceHash: string;
    sessionToken: string;
    subscription: OwnerPushSubscriptionPayload;
  }): Promise<OwnerPushSubscriptionState> {
    assertOwnerDeviceId(input.deviceHash);
    this.assertPushSubscription(input.subscription);
    return this.repository.savePushSubscription({
      deviceHash: input.deviceHash,
      endpointHash: await this.protector.hash(input.subscription.endpoint, "push-endpoint"),
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
      subscription: input.subscription,
    });
  }

  async revokePushSubscription(input: {
    deviceHash: string;
    endpoint: string;
    sessionToken: string;
  }): Promise<OwnerPushSubscriptionState> {
    assertOwnerDeviceId(input.deviceHash);
    if (input.endpoint.length < 16 || input.endpoint.length > 2000) {
      throw new OwnerActivationServiceError("INVALID_SECRET");
    }
    return this.repository.revokePushSubscription({
      deviceHash: input.deviceHash,
      endpointHash: await this.protector.hash(input.endpoint, "push-endpoint"),
      sessionHash: await this.hashRequired(input.sessionToken, "session"),
    });
  }

  async requestOtp(input: {
    deviceHash: string;
    locale: "en" | "ko";
    networkFingerprint: string;
    phone: string;
    publicToken: string;
  }): Promise<OwnerOtpRequestResult> {
    assertOwnerDeviceId(input.deviceHash);
    const phone = normalizeOwnerPhone(input.phone);
    const otp = normalizeOwnerOtp(this.secrets.createOtp());
    const result = await this.repository.requestOtp({
      deviceHash: input.deviceHash,
      networkHash: await this.hashNetwork(input.networkFingerprint),
      otpHash: await this.protector.hash(otp, "otp"),
      phone: await this.protector.protect(phone, "phone"),
      policy: this.policy,
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
    });
    try {
      await this.otpProvider.send({
        challengeId: result.challengeId,
        locale: input.locale,
        otp,
        phone,
      });
      await this.repository.markOtpDelivery({
        challengeId: result.challengeId,
        status: "SENT",
      });
      return result;
    } catch {
      await this.repository.markOtpDelivery({
        challengeId: result.challengeId,
        status: "FAILED",
      });
      throw new OwnerActivationServiceError("OTP_DELIVERY_FAILED");
    }
  }

  async requestReclaimOtp(input: {
    deviceHash: string;
    locale: "en" | "ko";
    networkFingerprint: string;
    phone: string;
    plate: string;
    publicToken: string;
  }): Promise<OwnerOtpRequestResult> {
    assertOwnerDeviceId(input.deviceHash);
    const phone = normalizeOwnerPhone(input.phone);
    const plate = normalizeOwnerVehiclePlate(input.plate);
    const otp = normalizeOwnerOtp(this.secrets.createOtp());
    const result = await this.repository.requestReclaimOtp({
      deviceHash: input.deviceHash,
      networkHash: await this.hashNetwork(input.networkFingerprint),
      otpHash: await this.protector.hash(otp, "otp"),
      phone: await this.protector.protect(phone, "phone"),
      plateLookupHash: await this.protector.hash(plate, "vehicle-plate"),
      policy: this.policy,
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
    });
    try {
      await this.otpProvider.send({
        challengeId: result.challengeId,
        locale: input.locale,
        otp,
        phone,
      });
      await this.repository.markOtpDelivery({
        challengeId: result.challengeId,
        status: "SENT",
      });
      return result;
    } catch {
      await this.repository.markOtpDelivery({
        challengeId: result.challengeId,
        status: "FAILED",
      });
      throw new OwnerActivationServiceError("OTP_DELIVERY_FAILED");
    }
  }

  async verifyOtp(input: {
    challengeId: string;
    otp: string;
    publicToken: string;
  }): Promise<OwnerOtpVerification> {
    assertUuid(input.challengeId);
    const proof = this.requireOpaqueSecret(this.secrets.createProof());
    const result = await this.repository.verifyOtp({
      challengeId: input.challengeId,
      otpHash: await this.protector.hash(normalizeOwnerOtp(input.otp), "otp"),
      proofHash: await this.protector.hash(proof, "proof"),
      proofTtlSeconds: this.policy.proofTtlSeconds,
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
    });
    return { ...result, proof };
  }

  async complete(input: {
    consentAccepted: boolean;
    deviceHash: string;
    plate: string;
    privacyVersion: string;
    proof: string;
    publicToken: string;
    termsVersion: string;
  }): Promise<OwnerActivationSessionCompletion> {
    assertOwnerDeviceId(input.deviceHash);
    assertOwnerConsent({
      accepted: input.consentAccepted,
      privacyVersion: input.privacyVersion,
      termsVersion: input.termsVersion,
    });
    const sessionToken = this.requireOpaqueSecret(this.secrets.createSession());
    const completion = await this.repository.complete({
      consent: {
        privacyVersion: input.privacyVersion,
        termsVersion: input.termsVersion,
      },
      deviceHash: input.deviceHash,
      plate: await this.protector.protect(normalizeOwnerVehiclePlate(input.plate), "vehicle-plate"),
      proofHash: await this.hashRequired(input.proof, "proof"),
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
      sessionHash: await this.protector.hash(sessionToken, "session"),
      sessionTtlSeconds: this.policy.sessionTtlSeconds,
    });
    return { ...completion, sessionToken };
  }

  async verifyReclaimOtp(input: {
    challengeId: string;
    deviceHash: string;
    otp: string;
    publicToken: string;
  }): Promise<OwnerReclaimSession> {
    assertUuid(input.challengeId);
    assertOwnerDeviceId(input.deviceHash);
    const sessionToken = this.requireOpaqueSecret(this.secrets.createSession());
    const result = await this.repository.verifyReclaimOtp({
      challengeId: input.challengeId,
      deviceHash: input.deviceHash,
      otpHash: await this.protector.hash(normalizeOwnerOtp(input.otp), "otp"),
      publicTokenHash: await this.hashRequired(input.publicToken, "public-token"),
      sessionHash: await this.protector.hash(sessionToken, "session"),
      sessionTtlSeconds: this.policy.sessionTtlSeconds,
    });
    return { ...result, sessionToken };
  }

  private async hashRequired(value: string, purpose: OwnerActivationHashPurpose): Promise<string> {
    return this.protector.hash(this.requireOpaqueSecret(value), purpose);
  }

  private async hashNetwork(value: string): Promise<string> {
    if (value.length < 1 || value.length > 200) {
      throw new OwnerActivationServiceError("INVALID_SECRET");
    }
    return this.protector.hash(value, "network");
  }

  private requireOpaqueSecret(value: string): string {
    if (value.length < 16 || value.length > 500) {
      throw new OwnerActivationServiceError("INVALID_SECRET");
    }
    return value;
  }

  private assertPushSubscription(subscription: OwnerPushSubscriptionPayload): void {
    if (
      subscription.endpoint.length < 16 ||
      subscription.endpoint.length > 2000 ||
      subscription.keys.auth.length < 8 ||
      subscription.keys.auth.length > 512 ||
      subscription.keys.p256dh.length < 16 ||
      subscription.keys.p256dh.length > 512
    ) {
      throw new OwnerActivationServiceError("INVALID_SECRET");
    }
  }
}

export class OwnerActivationServiceError extends Error {
  constructor(readonly code: "INVALID_ID" | "INVALID_SECRET" | "OTP_DELIVERY_FAILED") {
    super(`Owner activation service rejected: ${code}`);
    this.name = "OwnerActivationServiceError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new OwnerActivationServiceError("INVALID_ID");
  }
}
