/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAmount } from "@/lib/format";
import type { StreamView } from "@/types/stream";

import { VestingCurve } from "./vesting-curve";

const START = 1_700_000_000;
const END = START + 3600;

const BASE: StreamView = {
  id: "42",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: "10000000",
  withdrawn: "0",
  vested: "5000000",
  withdrawable: "5000000",
  locked: "5000000",
  startTime: String(START),
  endTime: String(END),
  cliffTime: String(START),
  cancelled: false,
  status: "streaming",
  progress: 5000,
};

describe("VestingCurve", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((START + 900) * 1000);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function render(stream: StreamView) {
    act(() => {
      root.render(<VestingCurve stream={stream} />);
    });
  }

  it("renders the SVG curve without a cliff region", () => {
    render(BASE);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 160");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("polyline")?.getAttribute("points")).toBeTruthy();
    expect(svg?.querySelector("polygon")).not.toBeNull();
    expect(svg?.querySelector("rect")).toBeNull();
    // The current-time marker is drawn while the stream is within its range.
    expect(svg?.textContent).toContain("now");
  });

  it("draws the shaded cliff region when the stream has a cliff", () => {
    render({ ...BASE, cliffTime: String(START + 1800) });

    expect(container.querySelector("svg rect")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toContain("There is a cliff at");
  });

  it("still renders a chart for a cancelled stream", () => {
    render({ ...BASE, cancelled: true, status: "cancelled" });

    expect(container.querySelector("svg polyline")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toContain(
      "Current progress: 50%.",
    );
  });

  it("says a cancelled stream was cancelled and gives the frozen amount", () => {
    render({ ...BASE, cancelled: true, status: "cancelled", vested: "3000000" });

    const caption = container.querySelector("figcaption")?.textContent ?? "";
    expect(caption).toContain("This stream was cancelled");
    expect(caption).toContain(`frozen at ${formatAmount("3000000")} tokens`);
  });

  it("gives the chart an accessible name and description", () => {
    render(BASE);

    const figure = container.querySelector("figure");
    expect(figure?.getAttribute("aria-label")).toBe("Vesting curve chart");
    const caption = container.querySelector("figcaption");
    expect(caption?.textContent).toContain("Linear vesting schedule from");
    expect(caption?.textContent).not.toContain("cliff");
  });
});
