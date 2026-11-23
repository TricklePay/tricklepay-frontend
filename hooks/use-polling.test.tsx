/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePolling } from "./use-polling";

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
  fn,
  intervalMs,
  enabled = true,
}: {
  fn: (signal: AbortSignal) => void | Promise<void>;
  intervalMs: number;
  enabled?: boolean;
}) {
  usePolling(fn, intervalMs, enabled);
  return null;
}

describe("usePolling", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setVisibility("visible");
    setOnline(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setVisibility("visible");
    setOnline(true);
    vi.useRealTimers();
  });

  it("calls fn immediately on mount and then on each interval while visible and online", () => {
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(fn).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("does nothing when enabled is false", () => {
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} enabled={false} />);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts the active signal and clears the interval on unmount or when disabled", () => {
    const signals: AbortSignal[] = [];
    const fn = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
    });

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} enabled />);
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} enabled={false} />);
    });
    expect(signals[0].aborted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses the latest fn without restarting the interval", () => {
    const calls: string[] = [];

    act(() => {
      root.render(<Consumer fn={() => { calls.push("first"); }} intervalMs={1_000} />);
    });
    expect(calls).toEqual(["first"]);

    act(() => {
      vi.advanceTimersByTime(500);
      root.render(<Consumer fn={() => { calls.push("second"); }} intervalMs={1_000} />);
    });
    expect(calls).toEqual(["first"]);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(calls).toEqual(["first", "second"]);
  });

  it("does not update state when an aborted call resolves", async () => {
    let resolvePending!: (value: string) => void;
    const states: string[] = [];

    function StatefulConsumer({ enabled }: { enabled: boolean }) {
      const [value, setValue] = useState("initial");
      states.push(value);
      usePolling(
        (signal) => {
          void new Promise<string>((resolve) => {
            resolvePending = resolve;
          }).then((next) => {
            if (!signal.aborted) setValue(next);
          });
        },
        1_000,
        enabled,
      );
      return null;
    }

    act(() => {
      root.render(<StatefulConsumer enabled />);
    });
    expect(states).toEqual(["initial"]);

    act(() => {
      root.render(<StatefulConsumer enabled={false} />);
    });

    await act(async () => {
      resolvePending("stale");
    });

    expect(states.every((s) => s === "initial")).toBe(true);
  });

  it("stops probing while hidden and probes once immediately on becoming visible", () => {
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fn).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not probe on mount while hidden until becoming visible", () => {
    setVisibility("hidden");
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("continues polling when visibilityState is prerender", () => {
    setVisibility("prerender" as DocumentVisibilityState);
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("pauses while offline and probes once immediately when coming back online", () => {
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(fn).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits until both visible and online before probing", () => {
    setVisibility("hidden");
    setOnline(false);
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("removes visibility and network listeners on unmount", () => {
    const fn = vi.fn();

    act(() => {
      root.render(<Consumer fn={fn} intervalMs={1_000} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => root.unmount());

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
      setOnline(true);
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(5_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
