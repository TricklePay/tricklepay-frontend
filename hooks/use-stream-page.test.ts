import { describe, it, expect, vi, afterEach } from "vitest";

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

import { useStreamPage, PAGE_SIZE } from "./use-stream-page";
import { listStreams } from "@/lib/api";

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

// Drains the promise chain listStreams' rejection sets off (catch, then
// finally) before the test reads the resulting state back.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
      { sender: ADDRESS, limit: PAGE_SIZE, offset: 0, status: "all" },
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
});
