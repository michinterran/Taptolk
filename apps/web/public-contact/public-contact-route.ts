import "server-only";

import { randomUUID } from "node:crypto";
import { PublicContactServiceError } from "@taptolk/application";
import { PublicContactPolicyError } from "@taptolk/domain";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppLocale } from "../i18n/locale";
import { scheduleNotificationDispatchNudge } from "../notification-reply/notification-dispatch-nudge";
import { createPublicContactAnonymousToken } from "./public-contact-crypto";
import { createPublicContactService } from "./public-contact-runtime";
import { PublicContactRepositoryError } from "./supabase-public-contact-repository";

export const CALLER_ANONYMOUS_COOKIE_NAME = "tt_caller_anon";
export const CONTACT_SESSION_COOKIE_NAME = "tt_contact_session";

const inspectSchema = z
  .object({
    locale: z.enum(["ko", "en"]),
    publicToken: z.string().min(16).max(500),
  })
  .strict();

const createSchema = z
  .object({
    captchaToken: z.string().min(1).max(4_000).optional(),
    locale: z.enum(["ko", "en"]),
    message: z.string().min(1).max(500),
    messageMode: z.enum(["TEMPLATE", "FREE_TEXT"]),
    plateLast4: z.string().regex(/^[0-9]{4}$/u),
    publicToken: z.string().min(16).max(500),
    reasonCode: z.string().min(2).max(64),
  })
  .strict();

const reportSchema = z
  .object({
    reasonCode: z.string().min(3).max(64),
  })
  .strict();

function safeJson(data: Readonly<Record<string, unknown>>, status = 200): NextResponse {
  return NextResponse.json(
    { ...data, meta: { requestId: randomUUID() } },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
      status,
    },
  );
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof PublicContactRepositoryError) {
    const status = error.code === "LIMITED" ? 429 : error.code === "CONFLICT" ? 409 : 400;
    return safeJson({ error: { code: error.code } }, status);
  }
  if (
    error instanceof PublicContactPolicyError ||
    error instanceof PublicContactServiceError ||
    error instanceof z.ZodError
  ) {
    return safeJson({ error: { code: "VALIDATION" } }, 400);
  }
  if (error instanceof PublicContactRouteError) {
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
    throw new PublicContactRouteError();
  }
  return request.json();
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

function serviceOrThrow() {
  const service = createPublicContactService();
  if (!service) {
    throw new PublicContactRouteError();
  }
  return service;
}

export async function inspectPublicContact(request: Request): Promise<NextResponse> {
  try {
    const input = inspectSchema.parse(await readBody(request));
    if (!isAppLocale(input.locale)) {
      throw new PublicContactRouteError();
    }
    return safeJson({ data: await serviceOrThrow().inspect(input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function createPublicContact(request: Request): Promise<NextResponse> {
  try {
    const input = createSchema.parse(await readBody(request));
    if (!isAppLocale(input.locale)) {
      throw new PublicContactRouteError();
    }
    const anonymousToken =
      readCookie(request, CALLER_ANONYMOUS_COOKIE_NAME) ?? createPublicContactAnonymousToken();
    const existingSessionToken = readCookie(request, CONTACT_SESSION_COOKIE_NAME) ?? undefined;
    const { captchaToken, ...contactInput } = input;
    const result = await serviceOrThrow().create({
      ...contactInput,
      anonymousToken,
      ...(captchaToken ? { captchaToken } : {}),
      ...(existingSessionToken ? { existingSessionToken } : {}),
      networkFingerprint:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unavailable-network",
      userAgent: request.headers.get("user-agent") || "unavailable-user-agent",
    });
    const response = safeJson({
      data: {
        expiresAt: result.expiresAt,
        merged: result.merged,
        reasonCode: result.reasonCode,
        status: result.status,
      },
    });
    const secure = new URL(request.url).protocol === "https:";
    response.cookies.set({
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
      name: CALLER_ANONYMOUS_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure,
      value: anonymousToken,
    });
    response.cookies.set({
      httpOnly: true,
      maxAge: Math.max(1, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000)),
      name: CONTACT_SESSION_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure,
      value: result.sessionToken,
    });
    scheduleNotificationDispatchNudge("CONTACT_CREATED");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readCurrentPublicContact(request: Request): Promise<NextResponse> {
  try {
    const anonymousToken = readCookie(request, CALLER_ANONYMOUS_COOKIE_NAME);
    const sessionToken = readCookie(request, CONTACT_SESSION_COOKIE_NAME);
    if (!anonymousToken || !sessionToken) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    return safeJson({
      data: await serviceOrThrow().read({ anonymousToken, sessionToken }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function resolveCurrentPublicContact(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) {
      throw new PublicContactRouteError();
    }
    const tokens = recoveryTokens(request);
    if (!tokens) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    const result = await serviceOrThrow().resolve(tokens);
    const response = safeJson({ data: result });
    const secure = new URL(request.url).protocol === "https:";
    for (const name of [CALLER_ANONYMOUS_COOKIE_NAME, CONTACT_SESSION_COOKIE_NAME]) {
      response.cookies.set({
        httpOnly: true,
        maxAge: 0,
        name,
        path: "/",
        sameSite: "lax",
        secure,
        value: "",
      });
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

function recoveryTokens(request: Request): {
  anonymousToken: string;
  sessionToken: string;
} | null {
  const anonymousToken = readCookie(request, CALLER_ANONYMOUS_COOKIE_NAME);
  const sessionToken = readCookie(request, CONTACT_SESSION_COOKIE_NAME);
  return anonymousToken && sessionToken ? { anonymousToken, sessionToken } : null;
}

export async function readPublicContactEscalation(request: Request): Promise<NextResponse> {
  try {
    const tokens = recoveryTokens(request);
    if (!tokens) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    return safeJson({ data: await serviceOrThrow().escalation(tokens) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function requestPublicContactOfficeAlert(request: Request): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) {
      throw new PublicContactRouteError();
    }
    const tokens = recoveryTokens(request);
    if (!tokens) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    const result = await serviceOrThrow().officeAlert(tokens);
    scheduleNotificationDispatchNudge("OFFICE_ALERT_QUEUED");
    return safeJson({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function reportPublicContact(request: Request): Promise<NextResponse> {
  try {
    const input = reportSchema.parse(await readBody(request));
    const tokens = recoveryTokens(request);
    if (!tokens) {
      return safeJson({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    return safeJson({
      data: await serviceOrThrow().report({ ...tokens, reasonCode: input.reasonCode }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

class PublicContactRouteError extends Error {
  constructor() {
    super("PUBLIC_CONTACT_ROUTE_UNAVAILABLE");
    this.name = "PublicContactRouteError";
  }
}
