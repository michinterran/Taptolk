import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APPROVED_LOGO_SHA256, resolveApprovedLogoSource } from "./lib/approved-brand-assets.mjs";

const sourcePath = await resolveApprovedLogoSource();
const publicPath = resolve("apps/web/public/brand/taptolk-logo.png");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const [source, published] = await Promise.all([readFile(sourcePath), readFile(publicPath)]);
const sourceHash = sha256(source);
const publishedHash = sha256(published);

if (sourceHash !== APPROVED_LOGO_SHA256) {
  throw new Error(
    `Original logo changed: expected ${APPROVED_LOGO_SHA256}, received ${sourceHash}`,
  );
}

if (publishedHash !== APPROVED_LOGO_SHA256 || !source.equals(published)) {
  throw new Error("Published logo must be a byte-for-byte copy of the approved original.");
}

console.log(`[logo] immutable source and published asset verified (${APPROVED_LOGO_SHA256})`);
