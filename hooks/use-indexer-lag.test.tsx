/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIndexerLag } from "@/lib/api";

import { INDEXER_LAG_INTERVAL_MS, useIndexerLag } from "./use-indexer-lag";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIndexerLag: vi.fn(),
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

function Consumer({ onState }: { onState: (lag: number | null) => void }) {
  onState(useIndexerLag(true));
  return null;
}

describe("useIndexerLag", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setVisibility("visible");
    setOnline(true);
    vi.useFakeTimers();
    vi.mocked(getIndexerLag).mockResolvedValue(42);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setVisibility("visible");
    setOnline(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pauses polling while hidden and polls once on becoming visible", async () => {
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe(42);

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS * 3);
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(2);
  });

  it("keeps the last known lag while offline and resumes when online", async () => {
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(states.at(-1)).toBe(42);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS * 2);
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe(42);

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(2);
  });
});
