import "server-only";

import { createHash } from "node:crypto";
import {
  type OwnerContactNotification,
  type OwnerNotificationProvider,
  OwnerNotificationProviderError,
} from "@taptolk/application";
import type { NotificationProviderErrorCode } from "@taptolk/domain";
import type { NotificationReplyCrypto } from "./notification-reply-crypto";

export interface StagingInboxItem {
  idempotencyKey: string;
  responseToken: string;
}

interface StagingProviderState {
  inbox: Map<string, StagingInboxItem>;
  nextFailure: NotificationProviderErrorCode | null;
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

export function configureNotificationStagingFailure(
  code: NotificationProviderErrorCode | null,
): void {
  state.nextFailure = code;
}

export function readNotificationStagingInbox(): readonly StagingInboxItem[] {
  return [...state.inbox.values()];
}

export function clearNotificationStagingInbox(): void {
  state.inbox.clear();
  state.nextFailure = null;
}

export class StagingOwnerNotificationProvider implements OwnerNotificationProvider {
  constructor(private readonly crypto: NotificationReplyCrypto) {}

  async send(input: {
    idempotencyKey: string;
    notification: OwnerContactNotification;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }> {
    const destination = this.crypto.decryptOwnerPhone(input.toCiphertext);
    if (!/^010[0-9]{8}$/u.test(destination)) {
      throw new OwnerNotificationProviderError("INVALID_RECIPIENT");
    }
    if (state.nextFailure) {
      const code = state.nextFailure;
      state.nextFailure = null;
      throw new OwnerNotificationProviderError(code);
    }
    if (input.notification.templateKey !== "OWNER_CONTACT_REQUEST_V1") {
      throw new OwnerNotificationProviderError("PERMANENT_FAILURE");
    }
    const responseToken = input.notification.variables.responseUrl.match(
      /\/respond\/([A-Za-z0-9_-]{32,100})$/u,
    )?.[1];
    if (!responseToken) {
      throw new OwnerNotificationProviderError("PERMANENT_FAILURE");
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

export class UnavailableOwnerNotificationProvider implements OwnerNotificationProvider {
  async send(): Promise<never> {
    throw new OwnerNotificationProviderError("AUTH_ERROR");
  }
}
