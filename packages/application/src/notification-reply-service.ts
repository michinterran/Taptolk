import {
  assertResponseTokenTtl,
  DEFAULT_RESPONSE_TOKEN_TTL_SECONDS,
  getNotificationRetryDelaySeconds,
  isRetryableSmsProviderError,
  normalizeOwnerReply,
  type OwnerReplyCode,
  type SmsProviderErrorCode,
} from "@taptolk/domain";

export interface NotificationDeliveryClaim {
  deliveryId: string;
  destinationCiphertext: string;
  idempotencyKey: string;
  leaseVersion: number;
  locale: "en" | "ko";
  messageBody: string;
  responseToken: string;
}

export interface NotificationDeliveryRepository {
  claim(input: {
    leaseSeconds: number;
    limit: number;
    responseTokenHashes: readonly string[];
    workerId: string;
  }): Promise<readonly NotificationDeliveryClaim[]>;
  fail(input: {
    deliveryId: string;
    errorCode: SmsProviderErrorCode;
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

export interface NotificationSmsProvider {
  send(input: {
    body: string;
    idempotencyKey: string;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }>;
}

export interface NotificationSecretFactory {
  createResponseToken(): string;
}

export interface NotificationHasher {
  hash(value: string, purpose: "response-token"): Promise<string>;
}

export class NotificationSmsProviderError extends Error {
  constructor(readonly code: SmsProviderErrorCode) {
    super(`SMS provider rejected request: ${code}`);
    this.name = "NotificationSmsProviderError";
  }
}

export class NotificationDispatchService {
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly provider: NotificationSmsProvider,
    private readonly hasher: NotificationHasher,
    private readonly secrets: NotificationSecretFactory,
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
    const tokens = Array.from({ length: input.limit }, () => this.secrets.createResponseToken());
    const claims = await this.repository.claim({
      ...input,
      responseTokenHashes: await Promise.all(
        tokens.map((token) => this.hasher.hash(token, "response-token")),
      ),
    });
    let sent = 0;
    let retryScheduled = 0;
    let failedFinal = 0;
    for (const claim of claims) {
      try {
        const result = await this.provider.send({
          body: claim.messageBody,
          idempotencyKey: claim.idempotencyKey,
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
        const code = error instanceof NotificationSmsProviderError ? error.code : "UNKNOWN";
        const retryable = isRetryableSmsProviderError(code);
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
