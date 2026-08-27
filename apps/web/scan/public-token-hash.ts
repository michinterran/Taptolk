import "server-only";

import { createHash } from "node:crypto";

/**
 * Mirrors the issuance engine's persisted `qr_assets.public_token_hash`
 * contract. Public QR tokens are high-entropy credentials; their lookup value
 * is the SHA-256 digest required by the master development specification.
 */
export function hashPublicQrTokenLookup(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
