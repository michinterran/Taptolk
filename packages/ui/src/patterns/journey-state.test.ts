import { describe, expect, it } from "vitest";
import { isBusyJourneyState, JOURNEY_STATES, requiresRecoveryAction } from "./journey-state.js";

describe("journey state contract", () => {
  it("covers every foundational asynchronous state", () => {
    expect(JOURNEY_STATES).toEqual([
      "idle",
      "loading",
      "waiting",
      "empty",
      "success",
      "error",
      "retrying",
      "completed",
    ]);
  });

  it("distinguishes busy and recoverable states", () => {
    expect(isBusyJourneyState("waiting")).toBe(true);
    expect(isBusyJourneyState("completed")).toBe(false);
    expect(requiresRecoveryAction("error")).toBe(true);
  });
});
