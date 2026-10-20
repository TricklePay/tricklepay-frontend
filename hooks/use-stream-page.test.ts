// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// useStreamPage drives its state machine through real React hooks, which
// cannot run outside a component tree. Rather than add a DOM renderer or a
// testing-library dependency, this suite stands in for the handful of hooks
// the hook calls and re-renders it manually, so the failure branch — the page
// showing an error instead of loading forever when the API is unreachable —
// can be exercised headlessly.
const harness = vi.hoisted(() => {
  type Deps = unknown[];
  type StateCell = { value: unknown; set: (next: unknown) => void };
  type EffectCell = { fn: () => unknown; deps: Deps; cleanup?: () => unknown };

  const stateCells: StateCell[] = [];
  const refCells: { current: unknown }[] = [];
  const callbackCells: { fn: unknown; deps: Deps }[] = [];
  const effectCells: EffectCell[] = [];

  // Each hook type gets its own cursor, like React's per-hook-type indexes,
  // so the arrays are dense and identity lines up across renders.
  let stateCursor = 0;
  let refCursor = 0;
  let callbackCursor = 0;
  let effectCursor = 0;

  const depsEqual = (a: Deps, b: Deps): boolean =>
    a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]));

  return {
    // Runs the hook body again, giving each call site the cell it created on
    // the first pass (memoised callbacks and refs keep their identity, state
    // keeps its latest value) so a fresh read reflects previous setters.
    render<T>(fn: () => T): T {
      stateCursor = 0;
      refCursor = 0;
      callbackCursor = 0;
      effectCursor = 0;
      return fn();
    },

    useState(initial: unknown): [unknown, (next: unknown) => void] {
      let cell = stateCells[stateCursor];
      if (!cell) {
        cell = {
          value: initial,
          set(next) {
            cell.value = next;
          },
        };
        stateCells[stateCursor] = cell;
      }
      stateCursor += 1;
      return [cell.value, cell.set];
    },

    useRef<T>(initial: T): { current: T } {
      let cell = refCells[refCursor] as { current: T };
      if (!cell) {
        cell = { current: initial };
        refCells[refCursor] = cell;
      }
      refCursor += 1;
      return cell;
    },

    useCallback<T extends (...args: never[]) => unknown>(fn: T, deps: Deps): T {
      let cell = callbackCells[callbackCursor] as { fn: T; deps: Deps } | undefined;
      if (!cell || !depsEqual(cell.deps, deps)) {
        cell = { fn, deps };
        callbackCells[callbackCursor] = cell;
      }
      callbackCursor += 1;
      return cell.fn;
    },

    useEffect(fn: () => unknown, deps: Deps): void {
      let cell = effectCells[effectCursor];
      const changed = !cell || !depsEqual(cell.deps, deps);
      if (cell) {
        cell.fn = fn;
        cell.deps = deps;
      } else {
        cell = { fn, deps };
        effectCells[effectCursor] = cell;
      }
      effectCursor += 1;
      // Run a changed effect immediately so the fetch the test drives is
      // already in flight by the time the render returns.
      if (changed) {
        cell.cleanup?.();
        cell.cleanup = fn() as unknown as (() => unknown) | undefined;
      }
    },

    unmount() {
      for (const cell of effectCells) cell?.cleanup?.();
      stateCells.length = 0;
      refCells.length = 0;
      callbackCells.length = 0;
      effectCells.length = 0;
    },
  };
});

// The hook imports its primitives from react; route those calls to the harness.
vi.mock("react", () => ({
  useState: harness.useState,
  useRef: harness.useRef,
  useCallback: harness.useCallback,
  useEffect: harness.useEffect,
}));

// Keep the real API client (so isAbortError behaves) but let each test decide
// what listStreams resolves or rejects with.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, listStreams: vi.fn() };
});

import { listStreams } from "@/lib/api";
import type { StreamView } from "@/types/stream";

import {
  useStreamPage,
  PAGE_SIZE,
  CONSECUTIVE_REFRESH_FAILURES_THRESHOLD,
} from "./use-stream-page";

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const OTHER_ADDRESS = "GBBBI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function stream(id: string): StreamView {
  return {
    id,
    sender: ADDRESS,
    recipient: ADDRESS,
    token: TOKEN,
    totalAmount: "1000000000",
    withdrawn: "0",
    vested: "500000000",
    withdrawable: "500000000",
    locked: "500000000",
    startTime: "1000",
    endTime: "2000",
    cliffTime: "1000",
    cancelled: false,
    status: "streaming",
    progress: 5_000,
  };
}

function pageOf(streams: StreamView[]) {
  return { streams, total: streams.length, limit: PAGE_SIZE, offset: 0 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

// Drains the promise chain listStreams' rejection sets off (catch, then
// finally) before the test reads the resulting state back. Under fake timers a
// real setTimeout never fires, so advance the fake clock instead.
const flush = async () => {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(0);
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  vi.restoreAllMocks();
  harness.unmount();
});

describe("useStreamPage — load error", () => {
  it("surfaces an error and stops loading when the first page fetch fails", async () => {
    vi.mocked(listStreams).mockRejectedValue(new Error("Network unreachable"));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(listStreams).toHaveBeenCalledTimes(1);
    expect(listStreams).toHaveBeenCalledWith(
      { sender: ADDRESS, limit: PAGE_SIZE, offset: 0, status: "all", includeTotal: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(page.error).toBe("Network unreachable");
    expect(page.loading).toBe(false);
  });

  it("falls back to a generic message when the failure is not an Error", async () => {
    vi.mocked(listStreams).mockRejectedValue("the backend exploded");

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.error).toBe("Failed to load streams");
    expect(page.loading).toBe(false);
  });

  it("shows the loading state while the request is in flight and no error yet", () => {
    vi.mocked(listStreams).mockReturnValue(new Promise(() => {}));

    harness.render(() => useStreamPage("sender", ADDRESS));
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.loading).toBe(true);
    expect(page.error).toBeNull();
  });

  it("leaves lastUpdated null when the only fetch so far has failed", async () => {
    vi.mocked(listStreams).mockRejectedValue(new Error("Network unreachable"));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.lastUpdated).toBeNull();
  });

  it("surfaces requestId when the API error carries a requestId", async () => {
    const errorWithRequestId = Object.assign(new Error("Database query failed"), {
      requestId: "req-fail-456",
      code: "DB_ERROR",
    });
    vi.mocked(listStreams).mockRejectedValue(errorWithRequestId);

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.error).toBe("Database query failed");
    expect(page.requestId).toBe("req-fail-456");
  });
});

describe("useStreamPage — lastUpdated", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is null before the first fetch completes", () => {
    vi.mocked(listStreams).mockReturnValue(new Promise(() => {}));

    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.lastUpdated).toBeNull();
  });

  it("records when the first page finished loading", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.lastUpdated).toBe(NOW);
  });

  it("is refreshed by a manual refresh, not just the initial load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    const firstLoad = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(firstLoad.lastUpdated).toBe(NOW);

    const LATER = NOW + 45_000;
    vi.setSystemTime(LATER);
    firstLoad.refresh();
    await flush();
    const afterRefresh = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(afterRefresh.lastUpdated).toBe(LATER);
  });
});

describe("useStreamPage — background refresh failure threshold and reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns after reaching consecutive background refresh failure threshold and clears on successful refresh", async () => {
    // Initial page load succeeds
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();

    // Now mock subsequent background refreshes to fail
    vi.mocked(listStreams).mockRejectedValue(new Error("503 Service Unavailable"));

    // 1st background refresh failure (after 15s)
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.consecutiveRefreshFailures).toBe(1);
    expect(page.refreshWarning).toBeNull();

    // 2nd background refresh failure (after another 15s)
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.consecutiveRefreshFailures).toBe(2);
    expect(page.refreshWarning).toBeNull();

    // 3rd background refresh failure (after another 15s) -> hits threshold
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.consecutiveRefreshFailures).toBe(CONSECUTIVE_REFRESH_FAILURES_THRESHOLD);
    expect(page.refreshWarning).toBe("Data may be out of date.");

    // Next: manual refresh succeeds -> resets failures and clears warning
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });
    page.refresh();
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();
  });

  it("resets consecutive failures and warning when a subsequent background refresh succeeds", async () => {
    // Initial page load succeeds
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));

    // Mock failures
    vi.mocked(listStreams).mockRejectedValue(new Error("Network error"));

    // Fail 3 times to trigger warning
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(15_000);
      await flush();
    }
    page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.consecutiveRefreshFailures).toBe(CONSECUTIVE_REFRESH_FAILURES_THRESHOLD);
    expect(page.refreshWarning).toBe("Data may be out of date.");

    // Background refresh succeeds
    vi.mocked(listStreams).mockResolvedValue({ streams: [], total: 0, limit: PAGE_SIZE, offset: 0 });
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();
  });
});

describe("useStreamPage — background refresh triggers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("refetches the first page on a 15-second interval", async () => {
    vi.mocked(listStreams)
      .mockResolvedValueOnce(pageOf([stream("1")]))
      .mockResolvedValueOnce(pageOf([stream("2")]));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.streams.map((item) => item.id)).toEqual(["1"]);
    expect(listStreams).toHaveBeenCalledTimes(1);

    // Nothing happens just before the interval elapses.
    await vi.advanceTimersByTimeAsync(14_999);
    expect(listStreams).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(listStreams).toHaveBeenLastCalledWith(
      expect.objectContaining({ sender: ADDRESS, offset: 0 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(page.streams.map((item) => item.id)).toEqual(["2"]);
  });

  it("refetches when the window regains focus", async () => {
    vi.mocked(listStreams).mockResolvedValue(pageOf([stream("1")]));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await flush();

    const page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(page.streams.map((item) => item.id)).toEqual(["1"]);
  });

  it("skips the interval and focus refresh while the tab is hidden, then refetches on visibilitychange when visible", async () => {
    vi.mocked(listStreams).mockResolvedValue(pageOf([stream("1")]));
    setVisibility("hidden");

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    // Neither the timer nor a focus event fetches while the tab is hidden.
    await vi.advanceTimersByTimeAsync(15_000);
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    // Becoming visible again triggers a refresh through visibilitychange.
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    const page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(page.streams.map((item) => item.id)).toEqual(["1"]);
  });

  it("keeps existing rows and error state when a background refresh fails", async () => {
    vi.mocked(listStreams)
      .mockResolvedValueOnce(pageOf([stream("1")]))
      .mockRejectedValueOnce(new Error("503 Service Unavailable"));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.streams.map((item) => item.id)).toEqual(["1"]);
    expect(page.error).toBeNull();
    expect(page.loading).toBe(false);

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));

    // A silent refresh must not clear the list or flash an error.
    expect(page.streams.map((item) => item.id)).toEqual(["1"]);
    expect(page.error).toBeNull();
    expect(page.requestId).toBeNull();
    expect(page.loading).toBe(false);
    expect(page.consecutiveRefreshFailures).toBe(1);
    expect(page.refreshWarning).toBeNull();
  });

  it("does not replace an existing error when a background refresh fails", async () => {
    const firstPage = {
      ...pageOf(Array.from({ length: PAGE_SIZE }, (_, index) => stream(String(index + 1)))),
      total: PAGE_SIZE + 5,
    };
    vi.mocked(listStreams)
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error("Load more failed"))
      .mockRejectedValueOnce(new Error("Background refresh failed"));

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));

    page.loadMore();
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.error).toBe("Load more failed");
    expect(page.streams).toHaveLength(PAGE_SIZE);

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    page = harness.render(() => useStreamPage("sender", ADDRESS));

    expect(page.error).toBe("Load more failed");
    expect(page.requestId).toBeNull();
    expect(page.streams).toHaveLength(PAGE_SIZE);
    expect(page.consecutiveRefreshFailures).toBe(1);
  });

  it("ignores a background refresh that resolves after the address changes", async () => {
    let addressRequests = 0;
    const staleRefresh = deferred<ReturnType<typeof pageOf>>();

    vi.mocked(listStreams).mockImplementation((params) => {
      if (params?.sender === ADDRESS) {
        addressRequests += 1;
        if (addressRequests === 1) {
          return Promise.resolve(pageOf([stream("old")]));
        }
        return staleRefresh.promise;
      }
      return Promise.resolve(pageOf([stream("new")]));
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    let page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(page.streams.map((item) => item.id)).toEqual(["old"]);

    // Start a silent refresh for the old address, then switch addresses before
    // it resolves. The new address's first page has its own generation.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(addressRequests).toBe(2);

    harness.render(() => useStreamPage("sender", OTHER_ADDRESS));
    await flush();
    page = harness.render(() => useStreamPage("sender", OTHER_ADDRESS));
    expect(page.streams.map((item) => item.id)).toEqual(["new"]);

    staleRefresh.resolve(pageOf([stream("stale")]));
    await flush();
    page = harness.render(() => useStreamPage("sender", OTHER_ADDRESS));

    // The old response is dropped rather than replacing the new address's rows.
    expect(page.streams.map((item) => item.id)).toEqual(["new"]);
    expect(page.total).toBe(1);
  });
});
