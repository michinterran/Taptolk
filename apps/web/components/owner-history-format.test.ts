import { describe, expect, it } from "vitest";
import { formatHistoryResponseDuration } from "./owner-history-format";

describe("formatHistoryResponseDuration", () => {
  it("leaves missing response duration blank", () => {
    expect(formatHistoryResponseDuration(null, "ko")).toBeUndefined();
  });

  it("keeps sub-minute measured durations in seconds", () => {
    expect(formatHistoryResponseDuration(0, "ko")).toBe("0초");
    expect(formatHistoryResponseDuration(45, "en")).toBe("45s");
  });

  it("does not round measured response duration up to the next minute", () => {
    expect(formatHistoryResponseDuration(75, "ko")).toBe("1분 15초");
    expect(formatHistoryResponseDuration(120, "en")).toBe("2m");
  });
});
