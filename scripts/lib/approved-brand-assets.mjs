import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export const APPROVED_LOGO_BASENAME = "taptolk로고.png";
export const APPROVED_LOGO_SHA256 =
  "971b7d919208f172a96dbc25c8ec9f641fc01522a1aa7a35fc90feb86f2e546f";

export function findUnicodeEquivalentEntry(entries, expectedName) {
  const normalizedExpectedName = expectedName.normalize("NFC");
  const matches = entries.filter((entry) => entry.normalize("NFC") === normalizedExpectedName);

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Unicode-equivalent brand asset for ${expectedName}; found ${matches.length}.`,
    );
  }

  return matches[0];
}

export async function resolveApprovedLogoSource(root = process.cwd()) {
  const designDirectory = resolve(root, "design_concept");
  const entries = await readdir(designDirectory);
  const sourceName = findUnicodeEquivalentEntry(entries, APPROVED_LOGO_BASENAME);
  return resolve(designDirectory, sourceName);
}
