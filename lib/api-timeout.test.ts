import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listStreams,
  getStream,
  isAbortError,
  isTimeoutError,
  ApiTimeoutError,
} from "./api";

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

// A fetch stand-in that hangs until its signal is aborted, so only the timeout
// (or the caller) can end the request.
function hangingFetch() {
  return vi.fn((_url: URL | string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) reject(abortError());
      else signal.addEventListener("abort", () => reject(abortError()));
    });
  });
}

describe("request timeout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts a request that outlives its budget", async () => {
    global.fetch = hangingFetch() as unknown as typeof global.fetch;

    const pending = listStreams({}, { timeoutMs: 5000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("reports the timeout as a failure, not a cancellation", async () => {
    global.fetch = hangingFetch() as unknown as typeof global.fetch;

    const pending = getStream("1", { timeoutMs: 2000 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(2000);
    const error = await pending;

    // The hook and the detail page both swallow aborts; a timeout must not be
    // swallowed with them, or a dead backend would show an endless skeleton.
    expect(isTimeoutError(error)).toBe(true);
    expect(isAbortError(error)).toBe(false);
    expect((error as ApiTimeoutError).timeoutMs).toBe(2000);
  });

  it("names the resource and the elapsed budget in the message", async () => {
    global.fetch = hangingFetch() as unknown as typeof global.fetch;

    const pending = getStream("42", { timeoutMs: 7500 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(7500);
    const error = await pending;

    expect((error as Error).message).toContain("stream 42");
    expect((error as Error).message).toContain("7.5s");
  });

  it("leaves a caller abort as a cancellation, not a timeout", async () => {
    global.fetch = hangingFetch() as unknown as typeof global.fetch;

    const controller = new AbortController();
    const pending = listStreams({}, { signal: controller.signal, timeoutMs: 5000 }).catch(
      (error: unknown) => error,
    );

    controller.abort();
    const error = await pending;

    expect(isAbortError(error)).toBe(true);
    expect(isTimeoutError(error)).toBe(false);
  });

  it("clears the timer once the request settles", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ streams: [], total: 0 }),
    });

    await listStreams({}, { timeoutMs: 5000 });

    // A timer left behind would abort a controller nobody is using and, in a
    // long-lived page, accumulate one per request.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not arm a timer when the timeout is disabled", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ streams: [], total: 0 }),
    });

    const pending = listStreams({}, { timeoutMs: 0 });
    expect(vi.getTimerCount()).toBe(0);
    await expect(pending).resolves.toEqual({ streams: [], total: 0 });
  });

  it("still surfaces a non-2xx status rather than waiting for the timeout", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(listStreams({}, { timeoutMs: 5000 })).rejects.toThrow(
      "Failed to load streams (500)",
    );
  });

  it("still resolves 404 to null under a timeout budget", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(getStream("999", { timeoutMs: 5000 })).resolves.toBeNull();
  });
});
