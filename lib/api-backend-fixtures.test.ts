import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStream, listStreams } from "./api";
import { parseStreamListResponse, parseStreamView } from "./api-schema";
import error400 from "../test/fixtures/api/error-400.json";
import error404 from "../test/fixtures/api/error-404.json";
import error429 from "../test/fixtures/api/error-429.json";
import listWithTotal from "../test/fixtures/api/list-with-total.json";
import listWithoutTotal from "../test/fixtures/api/list-without-total.json";
import streamDetail from "../test/fixtures/api/stream-detail.json";

describe("API client against recorded backend fixtures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseStreamListResponse with recorded fixtures", () => {
    it("parses list response with total and nextCursor", () => {
      const parsed = parseStreamListResponse(listWithTotal);
      expect(parsed.streams).toHaveLength(1);
      expect(parsed.total).toBe(1);
      expect(parsed.limit).toBe(25);
      expect(parsed.offset).toBe(0);
      expect(parsed.nextCursor).toBe("cursor_eyJsYXN0SWQiOiIxIn0");
      expect(parsed.streams[0].id).toBe("1");
      expect(parsed.streams[0].status).toBe("streaming");
    });

    it("parses list response without total (omitted by backend default)", () => {
      const parsed = parseStreamListResponse(listWithoutTotal);
      expect(parsed.streams).toHaveLength(1);
      expect(parsed.total).toBeUndefined();
      expect(parsed.limit).toBe(25);
      expect(parsed.offset).toBe(0);
      expect(parsed.nextCursor).toBe("cursor_eyJsYXN0SWQiOiIxIn0");
      expect(parsed.streams[0].id).toBe("1");
    });
  });

  describe("parseStreamView with recorded fixtures", () => {
    it("parses real stream detail response", () => {
      const stream = parseStreamView(streamDetail);
      expect(stream.id).toBe("1");
      expect(stream.sender).toBe("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7");
      expect(stream.token).toBe("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
      expect(stream.totalAmount).toBe("1000000000");
      expect(stream.status).toBe("streaming");
      expect(stream.progress).toBe(5000);
    });
  });

  describe("error handling with recorded backend error fixtures", () => {
    it("handles 400 Bad Request fixture payload", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => error400,
      });

      await expect(listStreams({ sender: "invalid-query" })).rejects.toThrow(
        "Failed to load streams (400)",
      );
    });

    it("handles 404 Not Found fixture payload by returning null", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => error404,
      });

      const result = await getStream("nonexistent-stream-999");
      expect(result).toBeNull();
    });

    it("handles 429 Too Many Requests fixture payload", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => error429,
      });

      await expect(listStreams({})).rejects.toThrow("Failed to load streams (429)");
    });
  });
});
