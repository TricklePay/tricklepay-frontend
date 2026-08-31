import { describe, expect, it, vi, beforeEach } from "vitest";
import { listStreams, getStream } from "./api";

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
});
