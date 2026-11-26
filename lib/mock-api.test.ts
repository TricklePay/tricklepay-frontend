import { describe, expect, it } from "vitest";

import { parseStreamEvents, parseStreamListResponse, parseStreamView } from "./api-schema";
import { mockGetStream, mockGetStreamEvents, mockListStreams } from "./mock-api";

describe("mock API", () => {
  it("returns responses matching the API response types", async () => {
    const page = await mockListStreams();
    expect(() => parseStreamListResponse(page)).not.toThrow();
    expect(parseStreamListResponse(page)).toEqual(page);

    for (const stream of page.streams) {
      expect(() => parseStreamView(stream)).not.toThrow();
    }

    const first = page.streams[0];
    const single = await mockGetStream(first.id);
    expect(single).not.toBeNull();
    expect(() => parseStreamView(single)).not.toThrow();
    expect(single).toEqual(first);
  });

  it("covers more than one stream status", async () => {
    const statuses = new Set((await mockListStreams()).streams.map((s) => s.status));
    expect(statuses.size).toBeGreaterThan(1);
    expect(statuses.has("streaming")).toBe(true);
    expect(statuses.has("pending")).toBe(true);
  });

  it("returns null for an unknown stream id", async () => {
    expect(await mockGetStream("does-not-exist")).toBeNull();
  });

  it("returns validated event histories for known streams and an empty list for unknown ids", async () => {
    const stream1Events = await mockGetStreamEvents("1");
    expect(() => parseStreamEvents(stream1Events)).not.toThrow();
    expect(stream1Events.map((e) => e.kind)).toEqual(["created", "withdrawn"]);

    const cancelledEvents = await mockGetStreamEvents("4");
    expect(() => parseStreamEvents(cancelledEvents)).not.toThrow();
    expect(cancelledEvents.map((e) => e.kind)).toEqual(["created", "withdrawn", "cancelled"]);

    expect(await mockGetStreamEvents("does-not-exist")).toEqual([]);
  });
});
