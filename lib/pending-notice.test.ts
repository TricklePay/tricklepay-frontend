import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("returns null when nothing is pending", () => {
    expect(takePendingNotice()).toBeNull();
  });

  it("round-trips a notice and clears it after reading", () => {
    setPendingNotice({ message: "Stream created.", hash: "abc123" });
    expect(takePendingNotice()).toEqual({ message: "Stream created.", hash: "abc123" });
    expect(takePendingNotice()).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
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
