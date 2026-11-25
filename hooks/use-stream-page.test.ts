
/* @vitest-environment jsdom */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

// useStreamPage drives its state machine through real React hooks, which
// cannot run outside a component tree. This harness stubs the hooks and
// manually re-renders the hook to inspect state changes.
const harness = vi.hoisted(() => {
  type Deps = unknown[];
  type StateCell = {
    value: unknown;
    set: (next: unknown) => void;
  };
  type EffectCell = {
    fn: () => unknown;
    deps: Deps;
    cleanup?: () => unknown;
  };

  const stateCells: StateCell[] = [];
  const refCells: { current: unknown }[] = [];
  const callbackCells: { fn: unknown; deps: Deps }[] = [];
  const effectCells: EffectCell[] = [];

  let stateCursor = 0;
  let refCursor = 0;
  let callbackCursor = 0;
  let effectCursor = 0;

  const depsEqual = (a: Deps, b: Deps): boolean =>
    a.length === b.length &&
    a.every((dep, i) => Object.is(dep, b[i]));

  return {
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
            cell.value =
              typeof next === "function"
                ? (next as (prev: unknown) => unknown)(cell.value)
                : next;
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

    useCallback<T extends (...args: never[]) => unknown>(
      fn: T,
      deps: Deps,
    ): T {
      let cell = callbackCells[callbackCursor] as
        | { fn: T; deps: Deps }
        | undefined;

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

      if (changed) {
        cell.cleanup?.();
        cell.cleanup = fn() as
          | (() => unknown)
          | undefined;
      }
    },

    unmount() {
      for (const cell of effectCells) {
        cell?.cleanup?.();
      }

      stateCells.length = 0;
      refCells.length = 0;
      callbackCells.length = 0;
      effectCells.length = 0;
    },
  };
});

// Route React hook calls to the harness.
vi.mock("react", () => ({
  useState: harness.useState,
  useRef: harness.useRef,
  useCallback: harness.useCallback,
  useEffect: harness.useEffect,
}));

// Keep the real API client, but mock listStreams per test.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    listStreams: vi.fn(),
  };
});

import { ApiError, listStreams, parseRetryAfter } from "@/lib/api";

import {
  useStreamPage,
  PAGE_SIZE,
  CONSECUTIVE_REFRESH_FAILURES_THRESHOLD,
} from "./use-stream-page";

const ADDRESS =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

// Drain promise handlers and finally callbacks without depending on timers.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  harness.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useStreamPage — load error", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces an error and stops loading when the first page fetch fails", async () => {
    vi.mocked(listStreams).mockRejectedValue(
      new Error("Network unreachable"),
    );

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(listStreams).toHaveBeenCalledWith(
      {
        sender: ADDRESS,
        limit: PAGE_SIZE,
        status: "all",
        includeTotal: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(page.error).toBe("Network unreachable");
    expect(page.loading).toBe(false);
  });

  it("falls back to a generic message when the failure is not an Error", async () => {
    vi.mocked(listStreams).mockRejectedValue(
      "the backend exploded",
    );

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.error).toBe("Failed to load streams");
    expect(page.loading).toBe(false);
  });

  it("shows the loading state while the request is in flight and no error yet", () => {
    vi.mocked(listStreams).mockReturnValue(
      new Promise(() => {}),
    );

    harness.render(() => useStreamPage("sender", ADDRESS));

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.loading).toBe(true);
    expect(page.error).toBeNull();
  });

  it("leaves lastUpdated null when the only fetch so far has failed", async () => {
    vi.mocked(listStreams).mockRejectedValue(
      new Error("Network unreachable"),
    );

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.lastUpdated).toBeNull();
  });

  it("surfaces requestId when the API error carries a requestId", async () => {
    const errorWithRequestId = Object.assign(
      new Error("Database query failed"),
      {
        requestId: "req-fail-456",
        code: "DB_ERROR",
      },
    );

    vi.mocked(listStreams).mockRejectedValue(
      errorWithRequestId,
    );

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.error).toBe("Database query failed");
    expect(page.requestId).toBe("req-fail-456");
  });

  it("recovers when the first page retry succeeds", async () => {
    vi.setSystemTime(Date.UTC(2026, 0, 1, 12, 0, 0));

    vi.mocked(listStreams)
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce({
        streams: [],
        total: 0,
        limit: PAGE_SIZE,
        offset: 0,
      });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(page.error).toBeNull();
    expect(page.loading).toBe(false);
    expect(page.lastUpdated).toBe(
      Date.UTC(2026, 0, 1, 12, 0, 0) + 500,
    );
  });
});

describe("useStreamPage — lastUpdated", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is null before the first fetch completes", () => {
    vi.mocked(listStreams).mockReturnValue(
      new Promise(() => {}),
    );

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.lastUpdated).toBeNull();
  });

  it("records when the first page finished loading", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    const page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.lastUpdated).toBe(NOW);
  });

  it("is refreshed by a manual refresh, not just the initial load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    const firstLoad = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(firstLoad.lastUpdated).toBe(NOW);

    const LATER = NOW + 45_000;
    vi.setSystemTime(LATER);

    firstLoad.refresh();
    await flush();

    const afterRefresh = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(afterRefresh.lastUpdated).toBe(LATER);
  });
});

describe("useStreamPage — background refresh failure threshold and reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("warns after reaching consecutive background refresh failure threshold and clears on successful refresh", async () => {
    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();

    vi.mocked(listStreams).mockRejectedValue(
      new Error("503 Service Unavailable"),
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(1);
    expect(page.refreshWarning).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(2);
    expect(page.refreshWarning).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(
      CONSECUTIVE_REFRESH_FAILURES_THRESHOLD,
    );
    expect(page.refreshWarning).toBe(
      "Data may be out of date.",
    );

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    page.refresh();
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();
  });

  it("resets consecutive failures and warning when a subsequent background refresh succeeds", async () => {
    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    vi.mocked(listStreams).mockRejectedValue(
      new Error("Network error"),
    );

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(15_000);
      await flush();
    }

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(
      CONSECUTIVE_REFRESH_FAILURES_THRESHOLD,
    );
    expect(page.refreshWarning).toBe(
      "Data may be out of date.",
    );

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS),
    );

    expect(page.consecutiveRefreshFailures).toBe(0);
    expect(page.refreshWarning).toBeNull();
  });
});

function fakeStream(
  id: string,
): import("@/types/stream").StreamView {
  return {
    id,
    sender: ADDRESS,
    recipient:
      "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token:
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    totalAmount: "10000000",
    withdrawn: "0",
    vested: "0",
    withdrawable: "0",
    locked: "10000000",
    startTime: "1000",
    endTime: "2000",
    cliffTime: "1000",
    cancelled: false,
    status: "streaming",
    progress: 0,
  };
}

describe("useStreamPage — cursor pagination", () => {
  it("sends no cursor on the first page or refresh, and sends the last nextCursor on loadMore", async () => {
    vi.mocked(listStreams)
      .mockResolvedValueOnce({
        streams: [fakeStream("2")],
        total: 2,
        nextCursor: "cursor_after_2",
      })
      .mockResolvedValueOnce({
        streams: [fakeStream("1")],
        total: 2,
      })
      .mockResolvedValueOnce({
        streams: [fakeStream("2")],
        total: 2,
        nextCursor: "cursor_after_2",
      });

    harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 1),
    );
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      1,
      {
        sender: ADDRESS,
        limit: 1,
        status: "all",
        includeTotal: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(page.streams.map((s) => s.id)).toEqual(["2"]);
    expect(page.hasMore).toBe(true);

    page.loadMore();
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      2,
      {
        sender: ADDRESS,
        limit: 1,
        cursor: "cursor_after_2",
        status: "all",
        includeTotal: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(page.streams.map((s) => s.id)).toEqual(["2", "1"]);
    expect(page.hasMore).toBe(false);

    page.refresh();
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      3,
      {
        sender: ADDRESS,
        limit: 1,
        status: "all",
        includeTotal: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(page.streams.map((s) => s.id)).toEqual(["2"]);
    expect(page.hasMore).toBe(true);
  });

  it("paginates stably with nextCursor when a new stream is created between two pages", async () => {
    vi.mocked(listStreams)
      .mockResolvedValueOnce({
        streams: [fakeStream("3"), fakeStream("2")],
        total: 3,
        nextCursor: "cursor_after_2",
      })
      .mockResolvedValueOnce({
        streams: [fakeStream("1")],
        total: 4,
      });

    harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 2),
    );
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 2),
    );

    expect(page.streams.map((s) => s.id)).toEqual(["3", "2"]);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);

    page.loadMore();
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS, "all", 2),
    );

    expect(listStreams).toHaveBeenLastCalledWith(
      {
        sender: ADDRESS,
        limit: 2,
        cursor: "cursor_after_2",
        status: "all",
        includeTotal: true,
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(page.streams.map((s) => s.id)).toEqual([
      "3",
      "2",
      "1",
    ]);
    expect(page.total).toBe(4);
    expect(page.hasMore).toBe(false);
  });
});

describe("useStreamPage — Retry-After backoff", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
  let windowListeners: Map<string, Set<() => void>>;
  let documentListeners: Map<string, Set<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    windowListeners = new Map();
    documentListeners = new Map();

    vi.stubGlobal("window", {
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (!windowListeners.has(event)) windowListeners.set(event, new Set());
        windowListeners.get(event)!.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: () => void) => {
        windowListeners.get(event)?.delete(listener);
      }),
    });

    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (!documentListeners.has(event)) documentListeners.set(event, new Set());
        documentListeners.get(event)!.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: () => void) => {
        documentListeners.get(event)?.delete(listener);
      }),
    });
  });

  const fireWindowEvent = (event: string) => {
    for (const listener of windowListeners.get(event) ?? []) listener();
  };

  const fireDocumentEvent = (event: string) => {
    for (const listener of documentListeners.get(event) ?? []) listener();
  };

  it("waits at least Retry-After seconds before running the next background refresh", async () => {
    vi.mocked(listStreams).mockResolvedValueOnce({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    vi.mocked(listStreams).mockRejectedValueOnce(
      new ApiError("Too Many Requests", {
        status: 429,
        retryAfterSeconds: 45,
      }),
    );

    // First background refresh fires at 15s and receives Retry-After: 45.
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    // Normal 15s ticks inside the 45s window must not hit the backend.
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    // Still 1ms shy of the 45s Retry-After delay.
    await vi.advanceTimersByTimeAsync(14_999);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    // At exactly 45s after the 429, the refresh retries and succeeds.
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);

    // Once recovered, the normal 15s schedule resumes.
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(4);
  });

  it("honors Retry-After derived from an HTTP-date header", async () => {
    vi.mocked(listStreams).mockResolvedValueOnce({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    // At t = 15s, backend asks the client to wait until t = 65s (50s delay).
    const retryAfterDate = new Date(NOW + 65_000).toUTCString();
    vi.mocked(listStreams).mockImplementationOnce(async () => {
      throw new ApiError("Too Many Requests", {
        status: 429,
        retryAfterSeconds: parseRetryAfter(retryAfterDate),
      });
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    await vi.advanceTimersByTimeAsync(49_999);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);
  });

  it("suppresses focus and visibilitychange refreshes until Retry-After has elapsed", async () => {
    vi.mocked(listStreams).mockResolvedValueOnce({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    vi.mocked(listStreams).mockRejectedValueOnce(
      new ApiError("Too Many Requests", {
        status: 429,
        retryAfterSeconds: 45,
      }),
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    // Focus and visibility events 10s later must respect the 45s window.
    await vi.advanceTimersByTimeAsync(10_000);
    fireWindowEvent("focus");
    fireDocumentEvent("visibilitychange");
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    // After the remaining 35s elapse, the scheduled refresh runs.
    await vi.advanceTimersByTimeAsync(35_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);
  });

  it("keeps at least the normal 15s interval when Retry-After is shorter than 15s", async () => {
    vi.mocked(listStreams).mockResolvedValueOnce({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();

    vi.mocked(listStreams).mockRejectedValueOnce(
      new ApiError("Too Many Requests", {
        status: 429,
        retryAfterSeconds: 5,
      }),
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });

    // Focus during the 5s window is skipped.
    await vi.advanceTimersByTimeAsync(3_000);
    fireWindowEvent("focus");
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    // Scheduled refresh still waits the full 15s interval (12s remaining).
    await vi.advanceTimersByTimeAsync(11_999);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);
  });

  it("waits at least Retry-After seconds before retrying a rate-limited first page load", async () => {
    vi.mocked(listStreams)
      .mockRejectedValueOnce(
        new ApiError("Too Many Requests", {
          status: 429,
          retryAfterSeconds: 5,
        }),
      )
      .mockResolvedValueOnce({
        streams: [],
        total: 0,
        limit: PAGE_SIZE,
        offset: 0,
      });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    // Must not retry after the default 500ms delay.
    await vi.advanceTimersByTimeAsync(500);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_499);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush();

    const page = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(listStreams).toHaveBeenCalledTimes(2);
    expect(page.error).toBeNull();
    expect(page.loading).toBe(false);
  });

  it("delays background refresh after loadMore receives a 429 with Retry-After", async () => {
    vi.mocked(listStreams)
      .mockResolvedValueOnce({
        streams: [fakeStream("2")],
        total: 2,
        nextCursor: "cursor_after_2",
      })
      .mockRejectedValueOnce(
        new ApiError("Too Many Requests", {
          status: 429,
          retryAfterSeconds: 40,
        }),
      );

    harness.render(() => useStreamPage("sender", ADDRESS, "all", 1));
    await flush();

    const page = harness.render(() => useStreamPage("sender", ADDRESS, "all", 1));
    page.loadMore();
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    vi.mocked(listStreams).mockResolvedValue({
      streams: [fakeStream("2")],
      total: 2,
      nextCursor: "cursor_after_2",
    });

    // Normal 15s and 30s intervals must not trigger while within the 40s window.
    await vi.advanceTimersByTimeAsync(39_999);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);
  });

  it("delays background refresh when both first-page attempts fail with Retry-After", async () => {
    vi.mocked(listStreams)
      .mockRejectedValueOnce(
        new ApiError("Too Many Requests", {
          status: 429,
          retryAfterSeconds: 2,
        }),
      )
      .mockRejectedValueOnce(
        new ApiError("Too Many Requests", {
          status: 429,
          retryAfterSeconds: 45,
        }),
      )
      .mockResolvedValue({
        streams: [],
        total: 0,
        limit: PAGE_SIZE,
        offset: 0,
      });

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    // Wait out the first attempt's 2s Retry-After; second attempt fails with 45s.
    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    const errored = harness.render(() => useStreamPage("sender", ADDRESS));
    expect(errored.error).toBe("Too Many Requests");
    expect(errored.loading).toBe(false);

    // Background refresh must wait the full 45s from the second 429.
    await vi.advanceTimersByTimeAsync(44_999);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(3);
  });

  it("cancels a pending first-page Retry-After wait on unmount", async () => {
    vi.mocked(listStreams).mockRejectedValueOnce(
      new ApiError("Too Many Requests", {
        status: 429,
        retryAfterSeconds: 30,
      }),
    );

    harness.render(() => useStreamPage("sender", ADDRESS));
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);

    harness.unmount();

    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(listStreams).toHaveBeenCalledTimes(1);
  });
});
