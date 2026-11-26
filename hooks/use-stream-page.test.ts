
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

import { listStreams } from "@/lib/api";

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
      useStreamPage("sender", ADDRESS, 1),
    );
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS, 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      1,
      {
        sender: ADDRESS,
        limit: 1,
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
      useStreamPage("sender", ADDRESS, 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      2,
      {
        sender: ADDRESS,
        limit: 1,
        cursor: "cursor_after_2",
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
      useStreamPage("sender", ADDRESS, 1),
    );

    expect(listStreams).toHaveBeenNthCalledWith(
      3,
      {
        sender: ADDRESS,
        limit: 1,
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
      useStreamPage("sender", ADDRESS, 2),
    );
    await flush();

    let page = harness.render(() =>
      useStreamPage("sender", ADDRESS, 2),
    );

    expect(page.streams.map((s) => s.id)).toEqual(["3", "2"]);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);

    page.loadMore();
    await flush();

    page = harness.render(() =>
      useStreamPage("sender", ADDRESS, 2),
    );

    expect(listStreams).toHaveBeenLastCalledWith(
      {
        sender: ADDRESS,
        limit: 2,
        cursor: "cursor_after_2",
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
