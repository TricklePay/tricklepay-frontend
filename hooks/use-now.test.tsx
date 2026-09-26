/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./use-now";

function Consumer({ onRender }: { onRender: (now: number) => void }) {
  onRender(useNow(1_000));
  return null;
}

describe("useNow", () => {
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

  it("re-renders the caller on the given interval", () => {
    const renders: number[] = [];

    act(() => {
      root.render(<Consumer onRender={(now) => renders.push(now)} />);
    });
    expect(renders).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(renders).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(renders).toHaveLength(3);
  });

  it("advances the returned timestamp", () => {
    const renders: number[] = [];

    act(() => {
      root.render(<Consumer onRender={(now) => renders.push(now)} />);
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(renders[1]).toBeGreaterThan(renders[0]);
  });
});
