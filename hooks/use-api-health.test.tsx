/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkApiHealth } from "@/lib/api";

import { API_HEALTH_INTERVAL_MS, useApiHealth, type ApiHealth } from "./use-api-health";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  checkApiHealth: vi.fn(),
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
  onState: (health: ApiHealth) => void;
  enabled?: boolean;
}) {
  onState(useApiHealth(enabled));
  return null;
}

describe("useApiHealth", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setVisibility("visible");
    setOnline(true);
    vi.useFakeTimers();
    vi.mocked(checkApiHealth).mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setVisibility("visible");
    setOnline(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pauses probing while hidden and probes once on becoming visible", async () => {
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("reachable");

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS * 3);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(2);
  });

  it("keeps the last known state while offline instead of marking unreachable", async () => {
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(states.at(-1)).toBe("reachable");

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS * 2);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("reachable");

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(2);
  });

  it("probes on mount and again every interval", async () => {
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("reachable");

    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS);
    });
    expect(checkApiHealth).toHaveBeenCalledTimes(3);
  });

  it("starts as checking and reports unreachable when the probe says so, then recovers", async () => {
    vi.mocked(checkApiHealth).mockResolvedValueOnce(false);
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(states[0]).toBe("checking");
    expect(states.at(-1)).toBe("unreachable");

    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS);
    });
    expect(states.at(-1)).toBe("reachable");
  });

  it("reports unreachable when the probe rejects", async () => {
    vi.mocked(checkApiHealth).mockRejectedValueOnce(new Error("network down"));
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });

    expect(states.at(-1)).toBe("unreachable");
  });

  it("ignores an aborted probe instead of marking the API unreachable", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.mocked(checkApiHealth).mockRejectedValueOnce(abortError);
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });

    expect(checkApiHealth).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("checking");
  });

  it("aborts an in-flight probe on unmount, stops the timer and ignores a late result", async () => {
    const probe: { signal?: AbortSignal } = {};
    let resolveProbe: (ok: boolean) => void = () => {};
    vi.mocked(checkApiHealth).mockImplementation((options) => {
      probe.signal = options?.signal;
      return new Promise<boolean>((resolve) => {
        resolveProbe = resolve;
      });
    });
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer onState={(s) => states.push(s)} />);
    });
    expect(probe.signal?.aborted).toBe(false);
    const rendersBeforeUnmount = states.length;

    act(() => root.unmount());
    expect(probe.signal?.aborted).toBe(true);

    await act(async () => {
      resolveProbe(true);
    });
    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS * 3);
    });

    expect(states).toHaveLength(rendersBeforeUnmount);
    expect(states.at(-1)).toBe("checking");
    expect(checkApiHealth).toHaveBeenCalledTimes(1);
  });

  it("stays checking and makes no request while disabled", async () => {
    const states: ApiHealth[] = [];

    await act(async () => {
      root.render(<Consumer enabled={false} onState={(s) => states.push(s)} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(API_HEALTH_INTERVAL_MS * 3);
    });

    expect(checkApiHealth).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("checking");
  });
});
