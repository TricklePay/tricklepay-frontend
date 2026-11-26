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

function Consumer({
  onState,
  enabled = true,
}: {
  onState: (lag: number | null) => void;
  enabled?: boolean;
}) {
  onState(useIndexerLag(enabled));
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
    vi.mocked(getIndexerLag).mockReset().mockResolvedValue(42);
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

  it("is null until the first read resolves, then reports the lag", async () => {
    let resolveRead: (value: number | null) => void = () => {};
    vi.mocked(getIndexerLag).mockImplementation(
      () =>
        new Promise<number | null>((resolve) => {
          resolveRead = resolve;
        }),
    );
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBeNull();

    await act(async () => {
      resolveRead(7);
    });
    expect(states.at(-1)).toBe(7);
  });

  it("reads again every interval and replaces the stale value", async () => {
    vi.mocked(getIndexerLag).mockResolvedValueOnce(5).mockResolvedValueOnce(9);
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(states.at(-1)).toBe(5);

    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS);
    });
    expect(getIndexerLag).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe(9);
  });

  it("returns null when a read fails after a success, and recovers on the next success", async () => {
    vi.mocked(getIndexerLag)
      .mockResolvedValueOnce(42)
      .mockRejectedValueOnce(new Error("indexer down"));
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(states.at(-1)).toBe(42);

    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS);
    });
    expect(states.at(-1)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS);
    });
    expect(states.at(-1)).toBe(42);
  });

  it("returns null when the backend reports no figure", async () => {
    vi.mocked(getIndexerLag).mockResolvedValueOnce(42).mockResolvedValueOnce(null);
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS);
    });

    expect(states.at(-1)).toBeNull();
  });

  it("ignores an aborted read and keeps the last value", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.mocked(getIndexerLag).mockResolvedValueOnce(42).mockRejectedValueOnce(abortError);
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS);
    });

    expect(getIndexerLag).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe(42);
  });

  it("aborts an in-flight read on unmount, stops the timer and ignores a late result", async () => {
    const probe: { signal?: AbortSignal } = {};
    let resolveRead: (value: number | null) => void = () => {};
    vi.mocked(getIndexerLag).mockImplementation((options) => {
      probe.signal = options?.signal;
      return new Promise<number | null>((resolve) => {
        resolveRead = resolve;
      });
    });
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(probe.signal?.aborted).toBe(false);
    const rendersBeforeUnmount = states.length;

    act(() => root.unmount());
    expect(probe.signal?.aborted).toBe(true);

    await act(async () => {
      resolveRead(11);
    });
    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS * 3);
    });

    expect(states).toHaveLength(rendersBeforeUnmount);
    expect(getIndexerLag).toHaveBeenCalledTimes(1);
  });

  it("makes no request while disabled and stays null", async () => {
    const states: Array<number | null> = [];

    await act(async () => {
      root.render(<Consumer enabled={false} onState={(s) => states.push(s)} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(INDEXER_LAG_INTERVAL_MS * 3);
    });

    expect(getIndexerLag).not.toHaveBeenCalled();
    expect(states.at(-1)).toBeNull();
  });
});
