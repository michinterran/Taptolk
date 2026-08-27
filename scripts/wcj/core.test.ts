import { describe, expect, it } from "vitest";
import { calculateScore } from "./core.mjs";

describe("WCJ score", () => {
  it("passes a finding-free report", () => {
    expect(calculateScore([])).toMatchObject({ passed: true, total: 100 });
  });

  it("fails immediately on a critical finding", () => {
    const score = calculateScore([
      {
        category: "W",
        file: "example.tsx",
        id: "W001",
        message: "test",
        severity: "critical",
        title: "test",
      },
    ]);

    expect(score.passed).toBe(false);
    expect(score.categories.W.score).toBe(65);
  });
});
