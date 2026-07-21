import { describe, expect, it } from "vitest";
import { en, ko } from "./messages";

const koKeys = Object.keys(ko).sort();
const enKeys = Object.keys(en).sort();

describe("locale dictionary parity", () => {
  it("exposes the same keys in Korean and English", () => {
    expect(enKeys).toEqual(koKeys);
  });

  it("never ships an empty user-facing string", () => {
    for (const [key, value] of [...Object.entries(ko), ...Object.entries(en)]) {
      expect(value.trim(), `empty value for ${key}`).not.toBe("");
    }
  });
});

describe("public surface copy", () => {
  const publicPrefixes = ["landing.", "onboarding."];
  const publicEntries = [...Object.entries(ko), ...Object.entries(en)].filter(([key]) =>
    publicPrefixes.some((prefix) => key.startsWith(prefix)),
  );

  it("does not route public visitors to the administrator portal", () => {
    for (const [key, value] of publicEntries) {
      expect(value, `administrator path in ${key}`).not.toMatch(/\/admin/u);
    }
  });

  it("keeps administrator sign-in vocabulary out of the public surface", () => {
    const forbidden = [/관리자\s*로그인/u, /가입\s*요청/u, /admin sign in/iu, /sign up/iu];
    for (const [key, value] of publicEntries) {
      for (const pattern of forbidden) {
        expect(value, `administrator wording in ${key}`).not.toMatch(pattern);
      }
    }
  });

  it("keeps the reviewed Korean vocabulary", () => {
    for (const [key, value] of Object.entries(ko)) {
      if (!publicPrefixes.some((prefix) => key.startsWith(prefix))) {
        continue;
      }
      expect(value, `"익명" in ${key}`).not.toMatch(/익명/u);
      expect(value, `"관리업체" in ${key}`).not.toMatch(/관리업체/u);
    }
  });
});

describe("administrator portal copy", () => {
  const portalEntries = [...Object.entries(ko), ...Object.entries(en)].filter(([key]) =>
    key.startsWith("portal."),
  );

  it("does not claim enterprise SSO that is not implemented", () => {
    for (const [key, value] of portalEntries) {
      expect(value, `SSO claim in ${key}`).not.toMatch(/\bSSO\b|SAML|OIDC/iu);
    }
  });

  it("does not leak internal implementation vocabulary into the sales copy", () => {
    const internal = [/\bRLS\b/u, /\bAAL2\b/u, /\bJWT\b/u, /\bRBAC\b/u, /\bCron\b/u];
    for (const [key, value] of portalEntries) {
      for (const pattern of internal) {
        expect(value, `internal term in ${key}`).not.toMatch(pattern);
      }
    }
  });

  it("states that signing up requests approval rather than granting access", () => {
    expect(ko["portal.signupNote"]).toMatch(/승인/u);
    expect(en["portal.signupNote"]).toMatch(/approval/iu);
  });

  it("keeps the reviewed 1-100 per-batch quantity contract in the workflow copy", () => {
    expect(ko["portal.workflow.step2.description"]).toMatch(/1~100/u);
    expect(en["portal.workflow.step2.description"]).toMatch(/1 to 100/u);
  });
});
