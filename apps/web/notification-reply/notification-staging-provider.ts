import "server-only";

import { createHash } from "node:crypto";
import { type NotificationSmsProvider, NotificationSmsProviderError } from "@taptolk/application";
import type { SmsProviderErrorCode } from "@taptolk/domain";
import type { NotificationReplyCrypto } from "./notification-reply-crypto";

export interface StagingInboxItem {
  idempotencyKey: string;
  responseToken: string;
}

interface StagingProviderState {
  inbox: Map<string, StagingInboxItem>;
  nextFailure: SmsProviderErrorCode | null;
}

const root = globalThis as typeof globalThis & {
  __taptolkNotificationStagingProvider?: StagingProviderState;
};

function getState(): StagingProviderState {
  const existing = root.__taptolkNotificationStagingProvider;
  if (existing) {
    return existing;
  }
  const created: StagingProviderState = {
    inbox: new Map<string, StagingInboxItem>(),
    nextFailure: null,
  };
  root.__taptolkNotificationStagingProvider = created;
  return created;
}

const state = getState();

export function configureNotificationStagingFailure(code: SmsProviderErrorCode | null): void {
  state.nextFailure = code;
}

export function readNotificationStagingInbox(): readonly StagingInboxItem[] {
  return [...state.inbox.values()];
}

export function clearNotificationStagingInbox(): void {
  state.inbox.clear();
  state.nextFailure = null;
}

export class StagingNotificationSmsProvider implements NotificationSmsProvider {
  constructor(private readonly crypto: NotificationReplyCrypto) {}

  async send(input: {
    body: string;
    idempotencyKey: string;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }> {
    const destination = this.crypto.decryptOwnerPhone(input.toCiphertext);
    if (!/^010[0-9]{8}$/u.test(destination)) {
      throw new NotificationSmsProviderError("INVALID_RECIPIENT");
    }
    if (state.nextFailure) {
      const code = state.nextFailure;
      state.nextFailure = null;
      throw new NotificationSmsProviderError(code);
    }
    const responseToken = input.body.match(/\/respond\/([A-Za-z0-9_-]{32,100})/u)?.[1];
    if (!responseToken) {
      throw new NotificationSmsProviderError("PERMANENT_FAILURE");
    }
    if (!state.inbox.has(input.idempotencyKey)) {
      state.inbox.set(input.idempotencyKey, {
        idempotencyKey: input.idempotencyKey,
        responseToken,
      });
    }
    return {
      providerMessageId: createHash("sha256")
        .update(`staging-receipt:${input.idempotencyKey}`, "utf8")
        .digest("hex"),
    };
  }
}

export class UnavailableNotificationSmsProvider implements NotificationSmsProvider {
  async send(): Promise<never> {
    throw new NotificationSmsProviderError("AUTH_ERROR");
  }
}
