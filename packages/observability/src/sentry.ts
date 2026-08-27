import * as Sentry from "@sentry/node";
import { redactSensitiveData } from "./redaction.js";

export interface ServerObservabilityOptions {
  dsn?: string;
  environment: string;
  service: string;
}

export function initializeServerObservability(options: ServerObservabilityOptions): boolean {
  if (!options.dsn) {
    return false;
  }

  Sentry.init({
    beforeSend(event) {
      const redactedExtra = redactSensitiveData(event.extra);
      if (redactedExtra && typeof redactedExtra === "object") {
        event.extra = redactedExtra as Record<string, unknown>;
      } else {
        delete event.extra;
      }

      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;

        const redactedHeaders = redactSensitiveData(event.request.headers);
        if (redactedHeaders && typeof redactedHeaders === "object") {
          event.request.headers = redactedHeaders as Record<string, string>;
        } else {
          delete event.request.headers;
        }
      }
      return event;
    },
    dsn: options.dsn,
    environment: options.environment,
    initialScope: {
      tags: {
        service: options.service,
      },
    },
    sendDefaultPii: false,
  });

  return true;
}
