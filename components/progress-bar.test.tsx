import { describe, it, expect } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("renders zero progress correctly", () => {
    const element = ProgressBar({ value: 0 });
    expect(element.props["aria-valuenow"]).toBe(0);
    const inner = element.props.children;
    expect(inner.props.style.width).toBe("0%");
  });

  it("renders full progress correctly", () => {
    const element = ProgressBar({ value: 10000 });
    expect(element.props["aria-valuenow"]).toBe(100);
    const inner = element.props.children;
    expect(inner.props.style.width).toBe("100%");
  });

  it("clamps out-of-range values", () => {
    const negative = ProgressBar({ value: -500 });
    expect(negative.props["aria-valuenow"]).toBe(0);
    expect(negative.props.children.props.style.width).toBe("0%");

    const excessive = ProgressBar({ value: 15000 });
    expect(excessive.props["aria-valuenow"]).toBe(100);
    expect(excessive.props.children.props.style.width).toBe("100%");
  });
});
