/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePolling } from "./use-polling";

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("calls fn immediately on mount and then on each interval", () => {
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
});
