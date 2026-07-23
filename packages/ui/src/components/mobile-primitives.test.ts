import { describe, expect, it } from "vitest";
import {
  ChoiceRow,
  MobileCard,
  MobileFacts,
  MobileLink,
  MobilePrimary,
  MobileRows,
  MobileShell,
} from "../index.js";

/**
 * These assert the parts of the mobile canon that regressed by hand before: a
 * second card drawn inside a card, a missing value filled in with a zero, and a
 * selection state expressed as a colour rather than as a design-system class.
 */
describe("mobile primitives", () => {
  it("expresses card variants as classes, never as inline colour", () => {
    const plain = MobileCard({ children: null });
    const outlined = MobileCard({ children: null, center: true, outlined: true });

    expect(plain.props.className).toBe("tt-m-card");
    expect(outlined.props.className).toBe("tt-m-card tt-m-card--accent tt-m-card--center");
  });

  it("marks a chosen row with aria-pressed so the tint is not the only signal", () => {
    const selected = ChoiceRow({ label: "출차 요청", selected: true });
    const unselected = ChoiceRow({ label: "이동 요청" });

    expect(selected.props.children.props["aria-pressed"]).toBe(true);
    expect(unselected.props.children.props["aria-pressed"]).toBe(false);
  });

  it("renders a missing fact as an em dash rather than as zero", () => {
    const facts = MobileFacts({ facts: [{ label: "응답 시간" }] });
    const rows = MobileRows({ rows: [{ label: "연락처" }] });

    expect(facts.props.children[0].props.children[1].props.children).toBe("—");
    expect(rows.props.children[0].props.children[1].props.children).toBe("—");
  });

  it("keeps the tab bar out of the shell when a screen has no account behind it", () => {
    const caller = MobileShell({ children: null });

    expect(caller.props.children[3]).toBeUndefined();
  });

  it("defaults the primary to a non-submitting button and the link to the brand tone", () => {
    const primary = MobilePrimary({ children: "메시지 보내기" });
    const quiet = MobileLink({ children: "위치가 다릅니다", tone: "quiet" });

    expect(primary.props.type).toBe("button");
    expect(quiet.props.className).toBe("tt-m-quiet-link");
  });
});
