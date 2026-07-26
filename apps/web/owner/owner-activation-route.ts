import "server-only";

import { OwnerActivationServiceError } from "@taptolk/application";
import { OwnerActivationPolicyError } from "@taptolk/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppLocale } from "../i18n/locale";
import { createOwnerActivationService } from "./owner-activation-runtime";
import { OwnerActivationRepositoryError } from "./supabase-owner-activation-repository";

export const OWNER_SESSION_COOKIE_NAME = "tt_owner_session";

const sharedSchema = {
  deviceHash: z.string().regex(/^[0-9a-f]{64}$/u),
  locale: z.enum(["ko", "en"]),
  publicToken: z.string().min(16).max(500),
};

const inspectSchema = z
  .object({
    locale: sharedSchema.locale,
    publicToken: sharedSchema.publicToken,
  })
  .strict();

const requestOtpSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
    phone: z.string().min(10).max(20),
    publicToken: sharedSchema.publicToken,
  })
  .strict();

const verifyOtpSchema = z
  .object({
    challengeId: z.uuid(),
    locale: sharedSchema.locale,
    otp: z.string().min(6).max(12),
    publicToken: sharedSchema.publicToken,
  })
  .strict();

const reclaimRequestOtpSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
    phone: z.string().min(10).max(20),
    plate: z.string().min(5).max(20),
    publicToken: sharedSchema.publicToken,
  })
  .strict();

const reclaimVerifySchema = z
  .object({
    challengeId: z.uuid(),
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
    otp: z.string().min(6).max(12),
    publicToken: sharedSchema.publicToken,
  })
  .strict();

const completeSchema = z
  .object({
    consentAccepted: z.literal(true),
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
    plate: z.string().min(5).max(20),
    privacyVersion: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,31}$/u),
    proof: z.string().min(16).max(500),
    publicToken: sharedSchema.publicToken,
    termsVersion: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,31}$/u),
  })
  .strict();

const listVehiclesSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
  })
  .strict();

const ownerSessionSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
  })
  .strict();

const ownerMessageSchema = ownerSessionSchema
  .extend({
    sessionId: z.uuid(),
  })
  .strict();

const ownerMessageReplySchema = ownerMessageSchema
  .extend({
    body: z.string().max(500).optional(),
    code: z.string().min(3).max(64),
  })
  .strict();

const pushSubscriptionSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    locale: sharedSchema.locale,
    subscription: z
      .object({
        endpoint: z.url().max(2000),
        expirationTime: z.number().int().nonnegative().nullable().optional(),
        keys: z
          .object({
            auth: z.string().min(8).max(512),
            p256dh: z.string().min(16).max(512),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const revokePushSubscriptionSchema = z
  .object({
    deviceHash: sharedSchema.deviceHash,
    endpoint: z.url().max(2000),
    locale: sharedSchema.locale,
  })
  .strict();

function safeJson(data: Readonly<Record<string, unknown>>, status = 200): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof OwnerActivationRepositoryError) {
    const status = error.code === "LIMITED" ? 429 : error.code === "CONFLICT" ? 409 : 400;
    return safeJson({ error: { code: error.code } }, status);
  }
  if (error instanceof OwnerActivationPolicyError || error instanceof z.ZodError) {
    return safeJson({ error: { code: "VALIDATION" } }, 400);
  }
  if (error instanceof OwnerActivationServiceError) {
    return safeJson(
      { error: { code: error.code === "OTP_DELIVERY_FAILED" ? "DELIVERY" : "VALIDATION" } },
      error.code === "OTP_DELIVERY_FAILED" ? 503 : 400,
    );
  }
  if (error instanceof OwnerActivationRouteError) {
    return safeJson({ error: { code: "CONFIGURATION" } }, 503);
  }
  return safeJson({ error: { code: "UNAVAILABLE" } }, 503);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readBody(request: Request): Promise<unknown> {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    throw new OwnerActivationRouteError();
  }
  return request.json();
}

function serviceOrThrow() {
  const service = createOwnerActivationService();
  if (!service) {
    throw new OwnerActivationRouteError();
  }
  return service;
}

function readCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 1 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }
    return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return null;
}

export async function inspectOwnerActivation(request: Request): Promise<NextResponse> {
  try {
    const input = inspectSchema.parse(await readBody(request));
    if (!isAppLocale(input.locale)) {
      throw new OwnerActivationRouteError();
    }
    return safeJson({ data: await serviceOrThrow().inspect(input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function requestOwnerOtp(request: Request): Promise<NextResponse> {
  try {
    const input = requestOtpSchema.parse(await readBody(request));
    const service = serviceOrThrow();
    const networkFingerprint =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unavailable-network";
    const result = await service.requestOtp({
      ...input,
      networkFingerprint,
    });
    return safeJson({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function verifyOwnerOtp(request: Request): Promise<NextResponse> {
  try {
    const input = verifyOtpSchema.parse(await readBody(request));
    const result = await serviceOrThrow().verifyOtp(input);
    return safeJson({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

function networkFingerprint(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unavailable-network"
  );
}

function secondsUntil(value: string): number {
  return Math.max(1, Math.floor((new Date(value).getTime() - Date.now()) / 1000));
}

export async function requestOwnerReclaimOtp(request: Request): Promise<NextResponse> {
  try {
    const input = reclaimRequestOtpSchema.parse(await readBody(request));
    if (!isAppLocale(input.locale)) {
      throw new OwnerActivationRouteError();
    }
    const result = await serviceOrThrow().requestReclaimOtp({
      ...input,
      networkFingerprint: networkFingerprint(request),
    });
    return safeJson({
      data: {
        challengeId: result.challengeId,
        expiresInSeconds: secondsUntil(result.expiresAt),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function verifyOwnerReclaimOtp(request: Request): Promise<NextResponse> {
  try {
    const input = reclaimVerifySchema.parse(await readBody(request));
    if (!isAppLocale(input.locale)) {
      throw new OwnerActivationRouteError();
    }
    const result = await serviceOrThrow().verifyReclaimOtp(input);
    const response = safeJson({ data: { sessionExpiresAt: result.sessionExpiresAt } });
    response.cookies.set({
      httpOnly: true,
      maxAge: Math.max(
        1,
        Math.floor((new Date(result.sessionExpiresAt).getTime() - Date.now()) / 1000),
      ),
      name: OWNER_SESSION_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      value: result.sessionToken,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function completeOwnerActivation(request: Request): Promise<NextResponse> {
  try {
    const input = completeSchema.parse(await readBody(request));
    const result = await serviceOrThrow().complete(input);
    const response = safeJson({
      data: {
        ownerId: result.ownerId,
        qrStatus: result.qrStatus,
        sessionExpiresAt: result.sessionExpiresAt,
        vehicleId: result.vehicleId,
        vehiclePlateLast4: result.vehiclePlateLast4,
      },
    });
    response.cookies.set({
      httpOnly: true,
      maxAge: Math.max(
        1,
        Math.floor((new Date(result.sessionExpiresAt).getTime() - Date.now()) / 1000),
      ),
      name: OWNER_SESSION_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      value: result.sessionToken,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listOwnerVehicles(request: Request): Promise<NextResponse> {
  try {
    const input = listVehiclesSchema.parse(await readBody(request));
    const sessionToken = readCookie(request, OWNER_SESSION_COOKIE_NAME);
    if (!sessionToken) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    const vehicles = await serviceOrThrow().listVehicles({
      deviceHash: input.deviceHash,
      sessionToken,
    });
    return safeJson({ data: { vehicles } });
  } catch (error) {
    return errorResponse(error);
  }
}

function readOwnerSessionOrUnauthorized(request: Request): string | NextResponse {
  const sessionToken = readCookie(request, OWNER_SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
  }
  return sessionToken;
}

export async function listOwnerMessages(request: Request): Promise<NextResponse> {
  try {
    const input = ownerSessionSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const messages = await serviceOrThrow().listMessages({
      deviceHash: input.deviceHash,
      sessionToken,
    });
    return safeJson({ data: { messages } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readOwnerMessage(request: Request): Promise<NextResponse> {
  try {
    const input = ownerMessageSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const message = await serviceOrThrow().readMessage({
      deviceHash: input.deviceHash,
      sessionId: input.sessionId,
      sessionToken,
    });
    return safeJson({ data: { message } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function replyToOwnerMessage(request: Request): Promise<NextResponse> {
  try {
    const input = ownerMessageReplySchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const result = await serviceOrThrow().replyToMessage({
      ...(input.body === undefined ? {} : { body: input.body }),
      code: input.code,
      deviceHash: input.deviceHash,
      sessionId: input.sessionId,
      sessionToken,
    });
    return safeJson({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listOwnerHistory(request: Request): Promise<NextResponse> {
  try {
    const input = ownerSessionSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const history = await serviceOrThrow().listHistory({
      deviceHash: input.deviceHash,
      sessionToken,
    });
    return safeJson({ data: { history } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function ownerPushState(request: Request): Promise<NextResponse> {
  try {
    const input = ownerSessionSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const state = await serviceOrThrow().pushState({
      deviceHash: input.deviceHash,
      sessionToken,
    });
    return safeJson({ data: state });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function saveOwnerPushSubscription(request: Request): Promise<NextResponse> {
  try {
    const input = pushSubscriptionSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const state = await serviceOrThrow().savePushSubscription({
      deviceHash: input.deviceHash,
      sessionToken,
      subscription: {
        endpoint: input.subscription.endpoint,
        expirationTime: input.subscription.expirationTime ?? null,
        keys: input.subscription.keys,
      },
    });
    return safeJson({ data: state });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function revokeOwnerPushSubscription(request: Request): Promise<NextResponse> {
  try {
    const input = revokePushSubscriptionSchema.parse(await readBody(request));
    const sessionToken = readOwnerSessionOrUnauthorized(request);
    if (sessionToken instanceof NextResponse) {
      return sessionToken;
    }
    const state = await serviceOrThrow().revokePushSubscription({
      deviceHash: input.deviceHash,
      endpoint: input.endpoint,
      sessionToken,
    });
    return safeJson({ data: state });
  } catch (error) {
    return errorResponse(error);
  }
}

class OwnerActivationRouteError extends Error {
  constructor() {
    super("OWNER_ACTIVATION_ROUTE_UNAVAILABLE");
    this.name = "OwnerActivationRouteError";
  }
}
