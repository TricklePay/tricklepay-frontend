import { describe, expect, it, vi, beforeEach } from "vitest";
import { listStreams, getStream } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listStreams", () => {
    it("builds query parameters including status filter", async () => {
      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          json: async () => ({ streams: [], total: 0 }),
        });
      });

      await listStreams({
        sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        status: "streaming",
        limit: 25,
        offset: 0,
      });

      expect(requestedUrl).toContain("sender=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(requestedUrl).toContain("status=streaming");
      expect(requestedUrl).toContain("limit=25");
      expect(requestedUrl).toContain("offset=0");
    });

    it("omits status param when status is 'all' or undefined", async () => {
      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          json: async () => ({ streams: [], total: 0 }),
        });
      });

      await listStreams({
        recipient: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        status: "all",
      });

      expect(requestedUrl).toContain("recipient=GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
      expect(requestedUrl).not.toContain("status=");
    });

    it("throws a clear error on failed response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(listStreams({})).rejects.toThrow("Failed to load streams (500)");
    });
  });

  describe("getStream", () => {
    it("returns stream data when found", async () => {
      const mockStream = {
        id: "1",
        sender: "GA",
        recipient: "GB",
        token: "GC",
        totalAmount: "1000",
        withdrawn: "0",
        vested: "0",
        locked: "1000",
        withdrawable: "0",
        progress: 0,
        startTime: "100",
        endTime: "200",
        cliffTime: "100",
        status: "streaming",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockStream,
      });

      const res = await getStream("1");
      expect(res).toEqual(mockStream);
    });

    it("returns null on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const res = await getStream("999");
      expect(res).toBeNull();
    });
  });
});
