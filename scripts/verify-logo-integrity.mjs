import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const expectedSha256 = "971b7d919208f172a96dbc25c8ec9f641fc01522a1aa7a35fc90feb86f2e546f";
const sourcePath = resolve("design_concept/taptolk로고.png");
const publicPath = resolve("apps/web/public/brand/taptolk-logo.png");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const [source, published] = await Promise.all([readFile(sourcePath), readFile(publicPath)]);
const sourceHash = sha256(source);
const publishedHash = sha256(published);

if (sourceHash !== expectedSha256) {
  throw new Error(`Original logo changed: expected ${expectedSha256}, received ${sourceHash}`);
}

if (publishedHash !== expectedSha256 || !source.equals(published)) {
  throw new Error("Published logo must be a byte-for-byte copy of the approved original.");
}

console.log(`[logo] immutable source and published asset verified (${expectedSha256})`);
