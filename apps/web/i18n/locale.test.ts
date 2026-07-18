import { describe, expect, it } from "vitest";
import { detectLocale, getLocaleFromPathname, replaceLocaleInPathname } from "./locale";

describe("locale detection", () => {
  it("prioritizes an explicit cookie", () => {
    expect(detectLocale({ acceptLanguage: "ko-KR", cookieLocale: "en" })).toBe("en");
  });

  it("selects Korean when Korean is preferred", () => {
    expect(detectLocale({ acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.8" })).toBe("ko");
  });

  it.each(["en-US,en;q=0.9", "fr-FR,ko;q=0.8", "ja-JP", null])(
    "falls back to English for a foreign or missing preference: %s",
    (acceptLanguage) => {
      expect(detectLocale({ acceptLanguage })).toBe("en");
    },
  );
});

describe("localized paths", () => {
  it("reads only supported locale segments", () => {
    expect(getLocaleFromPathname("/ko/settings")).toBe("ko");
    expect(getLocaleFromPathname("/fr/settings")).toBeNull();
  });

  it("replaces only the locale segment", () => {
    expect(replaceLocaleInPathname("/ko/foundation", "en")).toBe("/en/foundation");
    expect(replaceLocaleInPathname("/", "ko")).toBe("/ko");
  });
});
