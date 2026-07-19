import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerResponseService } from "./notification-reply-runtime";

const inspectSchema = z.object({ responseToken: z.string().min(32).max(100) }).strict();
const replySchema = z
  .object({
    body: z.string().max(500).optional(),
    code: z.string().min(3).max(64),
    responseToken: z.string().min(32).max(100),
  })
  .strict();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    { ...body, meta: { requestId: randomUUID() } },
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

async function body(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    throw new Error("INVALID_REQUEST");
  }
  return request.json();
}

function service() {
  const result = createOwnerResponseService();
  if (!result) {
    throw new Error("UNAVAILABLE");
  }
  return result;
}

export async function inspectOwnerResponse(request: Request) {
  try {
    const input = inspectSchema.parse(await body(request));
    return json({ data: await service().inspect(input.responseToken) });
  } catch {
    return json({ error: { code: "UNAVAILABLE" } }, 400);
  }
}

export async function submitOwnerResponse(request: Request) {
  try {
    const input = replySchema.parse(await body(request));
    return json({
      data: await service().reply({
        ...(input.body === undefined ? {} : { body: input.body }),
        code: input.code,
        responseToken: input.responseToken,
      }),
    });
  } catch {
    return json({ error: { code: "UNAVAILABLE" } }, 400);
  }
}

export function notificationWorkerAuthorized(request: Request, secret: string): boolean {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ") || secret.length < 16) {
    return false;
  }
  const left = createHash("sha256").update(value.slice(7), "utf8").digest();
  const right = createHash("sha256").update(secret, "utf8").digest();
  return left.length === right.length && timingSafeEqual(left, right);
}
