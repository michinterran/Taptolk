import {
  assertResponseTokenTtl,
  type ContactReasonCode,
  DEFAULT_RESPONSE_TOKEN_TTL_SECONDS,
  getNotificationRetryDelaySeconds,
  isRetryableNotificationProviderError,
  type NotificationProviderErrorCode,
  normalizeOwnerReply,
  type OwnerReplyCode,
} from "@taptolk/domain";

export interface OwnerContactNotification {
  locale: "en" | "ko";
  templateKey: "OWNER_CONTACT_REQUEST_V1";
  variables: {
    reasonCode: ContactReasonCode;
    responseUrl: string;
  };
}

export interface NotificationDeliveryClaim {
  deliveryId: string;
  destinationCiphertext: string;
  idempotencyKey: string;
  leaseVersion: number;
  notification: OwnerContactNotification;
}

export interface NotificationDeliveryRepository {
  claim(input: {
    leaseSeconds: number;
    limit: number;
    workerId: string;
  }): Promise<readonly NotificationDeliveryClaim[]>;
  fail(input: {
    deliveryId: string;
    errorCode: NotificationProviderErrorCode;
    final: boolean;
    leaseVersion: number;
    nextAttemptAt: string | null;
    workerId: string;
  }): Promise<void>;
  sent(input: {
    deliveryId: string;
    leaseVersion: number;
    providerMessageId: string;
    workerId: string;
  }): Promise<void>;
}

export interface OwnerNotificationProvider {
  send(input: {
    idempotencyKey: string;
    notification: OwnerContactNotification;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }>;
}

export interface NotificationSecretFactory {
  createResponseToken(): string;
}

export interface NotificationHasher {
  hash(value: string, purpose: "response-token"): Promise<string>;
}

export class OwnerNotificationProviderError extends Error {
  constructor(readonly code: NotificationProviderErrorCode) {
    super(`Owner notification provider rejected request: ${code}`);
    this.name = "OwnerNotificationProviderError";
  }
}

export class NotificationDispatchService {
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly provider: OwnerNotificationProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(input: {
    leaseSeconds: number;
    limit: number;
    workerId: string;
  }): Promise<{ claimed: number; failedFinal: number; retryScheduled: number; sent: number }> {
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100 ||
      !Number.isInteger(input.leaseSeconds) ||
      input.leaseSeconds < 5 ||
      input.leaseSeconds > 300 ||
      input.workerId.length < 8
    ) {
      throw new Error("INVALID_NOTIFICATION_DISPATCH_INPUT");
    }
    const claims = await this.repository.claim({
      ...input,
    });
    let sent = 0;
    let retryScheduled = 0;
    let failedFinal = 0;
    for (const claim of claims) {
      try {
        const result = await this.provider.send({
          idempotencyKey: claim.idempotencyKey,
          notification: claim.notification,
          toCiphertext: claim.destinationCiphertext,
        });
        await this.repository.sent({
          deliveryId: claim.deliveryId,
          leaseVersion: claim.leaseVersion,
          providerMessageId: result.providerMessageId,
          workerId: input.workerId,
        });
        sent += 1;
      } catch (error) {
        const code = error instanceof OwnerNotificationProviderError ? error.code : "UNKNOWN";
        const retryable = isRetryableNotificationProviderError(code);
        const attempt = claim.leaseVersion;
        const nextAttemptAt = retryable
          ? new Date(
              this.now().getTime() + getNotificationRetryDelaySeconds(attempt) * 1_000,
            ).toISOString()
          : null;
        await this.repository.fail({
          deliveryId: claim.deliveryId,
          errorCode: code,
          final: !retryable,
          leaseVersion: claim.leaseVersion,
          nextAttemptAt,
          workerId: input.workerId,
        });
        if (retryable) {
          retryScheduled += 1;
        } else {
          failedFinal += 1;
        }
      }
    }
    return { claimed: claims.length, failedFinal, retryScheduled, sent };
  }
}

export interface OwnerResponseInspection {
  callerMessage: string;
  expiresAt: string;
  reasonCode: string;
  siteDisplayName: string;
  vehiclePlateLast4: string;
}

export interface OwnerResponseRepository {
  inspect(input: { responseTokenHash: string }): Promise<OwnerResponseInspection>;
  reply(input: {
    body: string | null;
    replyCode: OwnerReplyCode;
    responseTokenHash: string;
  }): Promise<{ status: "OWNER_REPLIED" }>;
}

export class OwnerResponseService {
  constructor(
    private readonly repository: OwnerResponseRepository,
    private readonly hasher: NotificationHasher,
    tokenTtlSeconds = DEFAULT_RESPONSE_TOKEN_TTL_SECONDS,
  ) {
    assertResponseTokenTtl(tokenTtlSeconds);
  }

  async inspect(responseToken: string): Promise<OwnerResponseInspection> {
    return this.repository.inspect({
      responseTokenHash: await this.hashToken(responseToken),
    });
  }

  async reply(input: {
    body?: string;
    code: string;
    responseToken: string;
  }): Promise<{ status: "OWNER_REPLIED" }> {
    const reply = normalizeOwnerReply({
      ...(input.body === undefined ? {} : { body: input.body }),
      code: input.code,
    });
    return this.repository.reply({
      body: reply.body,
      replyCode: reply.code,
      responseTokenHash: await this.hashToken(input.responseToken),
    });
  }

  private async hashToken(value: string): Promise<string> {
    if (value.length < 32 || value.length > 100) {
      throw new Error("INVALID_RESPONSE_TOKEN");
    }
    return this.hasher.hash(value, "response-token");
  }
}
