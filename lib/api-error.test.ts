import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getStream, listStreams, parseRetryAfter } from "./api";

describe("api client — non-success responses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listStreams error handling", () => {
    it("converts a 500 server error response to a descriptive Error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(listStreams({})).rejects.toThrow("Failed to load streams (500)");
    });

    it("converts a 503 service unavailable response to a descriptive Error with status code", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      const promise = listStreams({});
      await expect(promise).rejects.toThrow(Error);
      await expect(promise).rejects.toThrow("Failed to load streams (503)");
    });

    it("converts a 400 bad request response to an Error carrying status information", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(listStreams({ sender: "invalid-key" })).rejects.toThrow(
        "Failed to load streams (400)",
      );
    });

    it("preserves backend code, error, and requestId when present in a JSON error body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          code: "INVALID_PARAMETERS",
          error: "Sender address is invalid",
          requestId: "req-abc-123",
        }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.message).toBe("Sender address is invalid");
        expect(apiErr.code).toBe("INVALID_PARAMETERS");
        expect(apiErr.error).toBe("Sender address is invalid");
        expect(apiErr.backendError).toBe("Sender address is invalid");
        expect(apiErr.requestId).toBe("req-abc-123");
        expect(apiErr.status).toBe(400);
      }
    });

    it("handles a non-JSON error body gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new Error("SyntaxError: Unexpected token < in JSON at position 0");
        },
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.message).toBe("Failed to load streams (502)");
        expect(apiErr.code).toBeUndefined();
        expect(apiErr.error).toBeUndefined();
        expect(apiErr.requestId).toBeUndefined();
        expect(apiErr.status).toBe(502);
      }
    });

    it("propagates a network error unchanged", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

      await expect(listStreams({})).rejects.toThrow("Network connection refused");
    });
  });

  describe("getStream error handling", () => {
    it("converts a 500 server error response on getStream to a descriptive Error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(getStream("stream-123")).rejects.toThrow(
        "Failed to load stream stream-123 (500)",
      );
    });

    it("converts a 403 forbidden response on getStream to a descriptive Error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      await expect(getStream("stream-456")).rejects.toThrow(
        "Failed to load stream stream-456 (403)",
      );
    });

    it("preserves backend code, error, and requestId on getStream with JSON error body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const notFoundResult = await getStream("non-existent");
      expect(notFoundResult).toBeNull();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          code: "STREAM_READ_FAILED",
          error: "Stream corrupted or unreadable",
          requestId: "req-xyz-789",
        }),
      });

      try {
        await getStream("stream-corrupt");
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.message).toBe("Stream corrupted or unreadable");
        expect(apiErr.code).toBe("STREAM_READ_FAILED");
        expect(apiErr.requestId).toBe("req-xyz-789");
        expect(apiErr.status).toBe(500);
      }
    });

    it("returns null for a 404 not found without throwing an error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await getStream("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("Retry-After header parsing", () => {
    const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

    afterEach(() => {
      vi.useRealTimers();
    });

    it("parses numeric delay-seconds on a 429 response into ApiError.retryAfter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "Retry-After": "45" }),
        json: async () => ({
          error: "Too Many Requests",
          code: "RATE_LIMITED",
        }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryAfter).toBe(45);
      }
    });

    it("parses numeric zero delay-seconds as 0 rather than undefined", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "retry-after": " 0 " }),
        json: async () => ({ error: "Too Many Requests" }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).retryAfter).toBe(0);
      }
    });

    it("parses an HTTP-date Retry-After header into seconds relative to now", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const retryAt = new Date(NOW + 90_000).toUTCString();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "Retry-After": retryAt }),
        json: async () => ({ error: "Too Many Requests" }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryAfter).toBe(90);
      }
    });

    it("rounds fractional HTTP-date delays up so callers wait at least until the timestamp", () => {
      const retryAt = new Date(NOW + 30_000).toUTCString();
      expect(parseRetryAfter(retryAt, NOW + 250)).toBe(30);
    });

    it("clamps HTTP-date values in the past to 0 seconds", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);

      const past = new Date(NOW - 10_000).toUTCString();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "Retry-After": past }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).retryAfter).toBe(0);
      }
    });

    it("parses obsolete RFC 850 and asctime HTTP-date formats in UTC", () => {
      expect(parseRetryAfter("Thursday, 01-Jan-26 12:00:30 GMT", NOW)).toBe(30);
      expect(parseRetryAfter("Thu Jan  1 12:00:30 2026", NOW)).toBe(30);
    });

    it("exposes Retry-After on getStream errors as well", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "Retry-After": "12" }),
      });

      try {
        await getStream("123");
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).retryAfter).toBe(12);
      }
    });

    it("leaves retryAfter undefined when the header is missing or malformed", async () => {
      expect(parseRetryAfter(null, NOW)).toBeUndefined();
      expect(parseRetryAfter(undefined, NOW)).toBeUndefined();
      expect(parseRetryAfter("", NOW)).toBeUndefined();
      expect(parseRetryAfter("   ", NOW)).toBeUndefined();
      expect(parseRetryAfter("-5", NOW)).toBeUndefined();
      expect(parseRetryAfter("1.5", NOW)).toBeUndefined();
      expect(parseRetryAfter("+10", NOW)).toBeUndefined();
      expect(parseRetryAfter("not-a-date", NOW)).toBeUndefined();
      expect(parseRetryAfter("Thu, 32 Jan 2026 12:00:00 GMT", NOW)).toBeUndefined();
      expect(parseRetryAfter("999999999999999999999", NOW)).toBeUndefined();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "Retry-After": "invalid" }),
      });

      try {
        await listStreams({});
        expect.unreachable("should have thrown");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).retryAfter).toBeUndefined();
      }
    });
  });
});
