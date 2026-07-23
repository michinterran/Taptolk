import { describe, expect, it } from "vitest";
import { Badge, Button, MeterBar, toneClass } from "../index.js";

describe("renewal primitives", () => {
  it("composes tone class names without inventing color values", () => {
    expect(toneClass("tt-badge")).toBe("tt-badge");
    expect(toneClass("tt-badge", "warning")).toBe("tt-badge tt-badge--warning");
  });

  it("keeps button variant and size expressed as design-system classes", () => {
    const button = Button({ children: "Save", size: "compact", variant: "secondary" });

    expect(button.props.className).toBe("tt-button tt-button--secondary tt-button--compact");
  });

  it("renders primitive classes for badges and meters", () => {
    const badge = Badge({ children: "Risk level", tone: "danger" });
    const meter = MeterBar({ value: 25, max: 50 });

    expect(badge.props.className).toBe("tt-badge tt-badge--danger");
    expect(meter.props.children.props.style.width).toBe("50%");
  });
});
