import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPendingNotice, takePendingNotice } from "@/lib/pending-notice";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("pending notice", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is pending", () => {
    expect(takePendingNotice()).toBeNull();
  });

  it("round-trips a notice", () => {
    setPendingNotice({ message: "Stream created.", hash: "abc123" });
    expect(takePendingNotice()).toEqual({ message: "Stream created.", hash: "abc123" });
    // Storage itself is cleared on the first read, so nothing is pending
    // beyond the short remount-replay window.
    const stored = (sessionStorage as unknown as { getItem: (k: string) => string | null })
      .getItem("tricklepay:pending-notice");
    expect(stored).toBeNull();
  });

  it("replays a just-consumed notice for remounting consumers", () => {
    vi.useFakeTimers();
    setPendingNotice({ message: "Stream created.", hash: "abc123" });
    const first = takePendingNotice();
    expect(first).toEqual({ message: "Stream created.", hash: "abc123" });
    // A second consumer mounting moments later (StrictMode double effect,
    // hydration retry) reads the same notice instead of losing it.
    expect(takePendingNotice()).toEqual(first);
  });

  it("stops replaying once the replay window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setPendingNotice({ message: "Stream created.", hash: "abc123" });
    expect(takePendingNotice()).not.toBeNull();
    vi.setSystemTime(1001);
    expect(takePendingNotice()).toBeNull();
  });

  it("a newer notice replaces the replayable one", () => {
    vi.useFakeTimers();
    setPendingNotice({ message: "first", hash: "1" });
    expect(takePendingNotice()).toEqual({ message: "first", hash: "1" });
    setPendingNotice({ message: "second", hash: "2" });
    expect(takePendingNotice()).toEqual({ message: "second", hash: "2" });
    expect(takePendingNotice()).toEqual({ message: "second", hash: "2" });
  });

  it("does not throw when storage is unavailable", () => {
    vi.useFakeTimers();
    // Move past any replay window left over from an earlier test.
    vi.setSystemTime(Date.now() + 10_000);
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("disabled");
      },
    });
    expect(() => setPendingNotice({ message: "x", hash: "y" })).not.toThrow();
    expect(takePendingNotice()).toBeNull();
  });
});
