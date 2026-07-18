import { describe, expect, it } from "vitest";
import { APPROVED_LOGO_BASENAME, findUnicodeEquivalentEntry } from "./approved-brand-assets.mjs";

describe("approved brand asset resolution", () => {
  it("matches the approved logo across NFC and NFD filesystems", () => {
    const decomposedName = APPROVED_LOGO_BASENAME.normalize("NFD");

    expect(findUnicodeEquivalentEntry([decomposedName], APPROVED_LOGO_BASENAME)).toBe(
      decomposedName,
    );
  });

  it("rejects missing or ambiguous Unicode-equivalent assets", () => {
    const decomposedName = APPROVED_LOGO_BASENAME.normalize("NFD");

    expect(() => findUnicodeEquivalentEntry([], APPROVED_LOGO_BASENAME)).toThrow("found 0");
    expect(() =>
      findUnicodeEquivalentEntry([APPROVED_LOGO_BASENAME, decomposedName], APPROVED_LOGO_BASENAME),
    ).toThrow("found 2");
  });
});
