import { describe, expect, it, vi, beforeEach } from "vitest";
import { listStreams, getStream, isAbortError } from "./api";

// A fetch stand-in that never resolves on its own and rejects the way a real
// one does once its signal is aborted.
function abortableFetch(): {
  fetch: ReturnType<typeof vi.fn>;
  signalOf: (call: number) => AbortSignal | undefined;
} {
  const signals: (AbortSignal | undefined)[] = [];
  const fetch = vi.fn((_url: URL | string, init?: RequestInit) => {
    const signal = init?.signal ?? undefined;
    signals.push(signal);
    return new Promise((_resolve, reject) => {
      if (!signal) return;
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      signal.addEventListener("abort", () => reject(abortError()));
    });
  });
  return { fetch, signalOf: (call) => signals[call] };
}

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

describe("request cancellation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isAbortError", () => {
    it("recognises an abort rejection", () => {
      expect(isAbortError(abortError())).toBe(true);
    });

    it("does not treat other failures as aborts", () => {
      expect(isAbortError(new Error("Failed to load streams (500)"))).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError("AbortError")).toBe(false);
    });
  });

  describe("listStreams", () => {
    it("passes the caller signal through to fetch", async () => {
      const { fetch, signalOf } = abortableFetch();
      global.fetch = fetch as unknown as typeof global.fetch;

      const controller = new AbortController();
      const pending = listStreams({}, { signal: controller.signal });

      expect(signalOf(0)).toBe(controller.signal);

      controller.abort();
      await expect(pending).rejects.toSatisfy(isAbortError);
    });

    it("rejects immediately when handed an already-aborted signal", async () => {
      const { fetch } = abortableFetch();
      global.fetch = fetch as unknown as typeof global.fetch;

      const controller = new AbortController();
      controller.abort();

      await expect(listStreams({}, { signal: controller.signal })).rejects.toSatisfy(
        isAbortError,
      );
    });

    it("works without a signal, as before", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ streams: [], total: 0 }),
      });

      await expect(listStreams({})).resolves.toEqual({ streams: [], total: 0 });
    });
  });

  describe("getStream", () => {
    it("passes the caller signal through to fetch", async () => {
      const { fetch, signalOf } = abortableFetch();
      global.fetch = fetch as unknown as typeof global.fetch;

      const controller = new AbortController();
      const pending = getStream("1", { signal: controller.signal });

      expect(signalOf(0)).toBe(controller.signal);

      controller.abort();
      await expect(pending).rejects.toSatisfy(isAbortError);
    });

    it("reports an abort during body decoding as a cancellation, not a bad payload", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw abortError();
        },
      });

      await expect(getStream("1")).rejects.toSatisfy(isAbortError);
    });
  });
});
