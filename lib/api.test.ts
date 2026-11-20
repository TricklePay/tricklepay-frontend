import { describe, expect, it, vi, beforeEach } from "vitest";

import { listStreams, getStream, getStreamEvents, ApiResponseError } from "./api";
import { config } from "./config";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listStreams", () => {
    it("builds query parameters accepted by the backend", async () => {
      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL) => {
        requestedUrl = url.href;
        const allowed = ["sender", "recipient", "limit", "offset", "cursor", "includeTotal"];
        if ([...url.searchParams.keys()].some((key) => !allowed.includes(key))) {
          return Promise.resolve(Response.json({ error: "Unknown query parameter" }, { status: 400 }));
        }
        return Promise.resolve(Response.json({ streams: [], total: 0 }));
      });

      await listStreams({
        sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        limit: 25,
        offset: 0,
        includeTotal: true,
      });

      // Ensure the base URL and path are composed correctly
      expect(requestedUrl).toContain(`${config.apiUrl}/streams`);

      expect(requestedUrl).toContain("sender=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(requestedUrl).toContain("limit=25");
      expect(requestedUrl).toContain("offset=0");
      expect(requestedUrl).toContain("includeTotal=true");
    });

    it("forwards cursor query parameter when provided", async () => {
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
        limit: 25,
        cursor: "cursor_abc123",
        includeTotal: true,
      });

      expect(requestedUrl).toContain("cursor=cursor_abc123");
      expect(requestedUrl).not.toContain("offset=");
    });

    it("builds a recipient query without extra parameters", async () => {
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

  describe("getStreamEvents", () => {
    it("fetches and validates stream events in order", async () => {
      const mockEvents = [
        {
          eventId: "0000000100000000-0001",
          kind: "created",
          streamId: "1",
          ledger: 1000,
          txHash: "tx-created",
          totalAmount: "10000000",
          closedAt: "1700000000",
        },
        {
          eventId: "0000000100000500-0001",
          kind: "withdrawn",
          streamId: "1",
          ledger: 1500,
          txHash: "tx-withdrawn",
          amount: "5000000",
          closedAt: "1700001800",
        },
      ];

      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: URL | string) => {
        requestedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockEvents,
        });
      });

      const res = await getStreamEvents("1");
      expect(requestedUrl).toBe(`${config.apiUrl}/streams/1/events`);
      expect(res).toEqual(mockEvents);
    });

    it("returns an empty array on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const res = await getStreamEvents("999");
      expect(res).toEqual([]);
    });

    it("throws on non-OK status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(getStreamEvents("1")).rejects.toThrow(
        "Failed to load events for stream 1 (500)",
      );
    });

    it("rejects malformed event payloads", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ eventId: "1", kind: "invalid" }],
      });

      await expect(getStreamEvents("1")).rejects.toThrow(ApiResponseError);
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
