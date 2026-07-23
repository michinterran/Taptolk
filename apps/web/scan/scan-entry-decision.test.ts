import { describe, expect, it } from "vitest";
import { decideScanScreen } from "./scan-entry-decision";

describe("scan entry decision", () => {
  it("sends a third party to the contact screen when the asset is active and bound", () => {
    expect(decideScanScreen({ activation: "NO_MATCH", contact: "MATCH" })).toEqual({
      screen: "CONTACT",
    });
  });

  it("sends the sticker holder to activation when the asset is not activated yet", () => {
    expect(decideScanScreen({ activation: "MATCH", contact: "NO_MATCH" })).toEqual({
      screen: "ACTIVATE",
    });
  });

  it("prefers contact when both probes match, so a bound sticker is never re-registered", () => {
    expect(decideScanScreen({ activation: "MATCH", contact: "MATCH" })).toEqual({
      screen: "CONTACT",
    });
  });

  it("reports an outage as an outage rather than as a revoked sticker", () => {
    expect(decideScanScreen({ activation: "UNAVAILABLE", contact: "UNAVAILABLE" })).toEqual({
      reason: "SERVICE",
      screen: "UNUSABLE",
    });
    expect(decideScanScreen({ activation: "UNAVAILABLE", contact: "NO_MATCH" })).toEqual({
      reason: "SERVICE",
      screen: "UNUSABLE",
    });
  });

  it("only says the sticker is unusable when both repositories answered and neither knew it", () => {
    expect(decideScanScreen({ activation: "NO_MATCH", contact: "NO_MATCH" })).toEqual({
      reason: "UNKNOWN",
      screen: "UNUSABLE",
    });
  });

  it("still answers a match while the other repository is down", () => {
    expect(decideScanScreen({ activation: "UNAVAILABLE", contact: "MATCH" })).toEqual({
      screen: "CONTACT",
    });
    expect(decideScanScreen({ activation: "MATCH", contact: "UNAVAILABLE" })).toEqual({
      screen: "ACTIVATE",
    });
  });
});
