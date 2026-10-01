/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MINIMUM_LOADING_DURATION_MS,
  useMinimumLoadingDuration,
} from "./use-minimum-loading-duration";

function Probe({ isLoading }: { isLoading: boolean }) {
  const visible = useMinimumLoadingDuration(isLoading);
  return <div>{visible ? "Loading" : "Ready"}</div>;
}

describe("useMinimumLoadingDuration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("retains a fast loading state until the minimum duration elapses", () => {
    act(() => root.render(<Probe isLoading />));
    expect(container.textContent).toBe("Loading");

    act(() => root.render(<Probe isLoading={false} />));
    expect(container.textContent).toBe("Loading");

    act(() => vi.advanceTimersByTime(MINIMUM_LOADING_DURATION_MS - 1));
    expect(container.textContent).toBe("Loading");

    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).toBe("Ready");
  });

  it("hides loading immediately when a slow operation completes", () => {
    act(() => root.render(<Probe isLoading />));
    act(() => vi.advanceTimersByTime(MINIMUM_LOADING_DURATION_MS + 50));

    act(() => root.render(<Probe isLoading={false} />));

    expect(container.textContent).toBe("Ready");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears a pending timer when unmounted", () => {
    act(() => root.render(<Probe isLoading />));
    act(() => root.render(<Probe isLoading={false} />));
    expect(vi.getTimerCount()).toBe(1);

    act(() => root.unmount());

    expect(vi.getTimerCount()).toBe(0);
  });
});