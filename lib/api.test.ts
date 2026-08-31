import { describe, expect, it, vi, beforeEach } from "vitest";
import { listStreams, getStream, ApiResponseError } from "./api";
import { config } from "./config";

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

      // Ensure the base URL and path are composed correctly
      expect(requestedUrl).toContain(`${config.apiUrl}/streams`);

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

    it("parses streams and pagination fields from the response", async () => {
      const page = {
        streams: [
          {
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
          },
        ],
        total: 42,
        limit: 25,
        offset: 5,
      };

      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({ ok: true, json: async () => page });
      });

      const res = await listStreams({});
      expect(requestedUrl).toBe(`${config.apiUrl}/streams`);
      expect(res).toEqual(page);
      expect(res.total).toBe(42);
      expect(res.limit).toBe(25);
      expect(res.offset).toBe(5);
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

      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockStream,
        });
      });

      const res = await getStream("1");
      expect(requestedUrl).toBe(`${config.apiUrl}/streams/1`);
      expect(res).toEqual(mockStream);
    });

    it("returns null on 404", async () => {
      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      const res = await getStream("999");
      expect(requestedUrl).toBe(`${config.apiUrl}/streams/999`);
      expect(res).toBeNull();
    });
  });

  describe("response validation", () => {
    it("rejects a stream list whose rows do not match the contract", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ streams: [{ id: "1" }], total: 1 }),
      });

      await expect(listStreams({})).rejects.toThrow(ApiResponseError);
    });

    it("rejects a stream whose amounts arrive as JSON numbers", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "1",
          sender: "GA",
          recipient: "GB",
          token: "GC",
          totalAmount: 1000,
          withdrawn: "0",
          vested: "0",
          locked: "1000",
          withdrawable: "0",
          progress: 0,
          startTime: "100",
          endTime: "200",
          cliffTime: "100",
          status: "streaming",
        }),
      });

      await expect(getStream("1")).rejects.toThrow(/totalAmount must be a string/);
    });

    it("reports a body that is not JSON at all", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      });

      await expect(listStreams({})).rejects.toThrow("Malformed API response: the stream list was not valid JSON.");
    });
  });
});
