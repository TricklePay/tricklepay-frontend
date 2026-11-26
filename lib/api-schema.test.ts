import { describe, expect, it } from "vitest";

import {
  ApiResponseError,
  parseStreamEvent,
  parseStreamEvents,
  parseStreamListResponse,
  parseStreamView,
} from "./api-schema";

function validStream(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    sender: "GAAA",
    recipient: "GBBB",
    token: "CCCC",
    totalAmount: "10000000",
    withdrawn: "0",
    vested: "5000000",
    withdrawable: "5000000",
    locked: "5000000",
    startTime: "100",
    endTime: "200",
    cliffTime: "100",
    cancelled: false,
    status: "streaming",
    progress: 5000,
    ...overrides,
  };
}

function omit(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

describe("parseStreamView", () => {
  it("returns the payload unchanged when it matches the contract", () => {
    const stream = validStream();
    expect(parseStreamView(stream)).toBe(stream);
  });

  it("accepts a payload without the optional cancelled flag", () => {
    const withoutFlag = omit(validStream(), "cancelled");
    expect(() => parseStreamView(withoutFlag)).not.toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => parseStreamView(null)).toThrow(ApiResponseError);
    expect(() => parseStreamView([])).toThrow(/must be an object/);
  });

  it("rejects a missing string field and names it", () => {
    const withoutRecipient = omit(validStream(), "recipient");
    expect(() => parseStreamView(withoutRecipient)).toThrow(
      /response\.recipient must be a string/,
    );
  });

  it("rejects an amount sent as a JSON number", () => {
    expect(() => parseStreamView(validStream({ totalAmount: 10000000 }))).toThrow(
      /response\.totalAmount must be a string/,
    );
  });

  it("rejects an amount that is not a decimal integer", () => {
    expect(() => parseStreamView(validStream({ withdrawn: "1.5" }))).toThrow(
      /response\.withdrawn must be a decimal integer string/,
    );
  });

  it("rejects a timestamp that is not a decimal integer", () => {
    expect(() => parseStreamView(validStream({ endTime: "" }))).toThrow(
      /response\.endTime must be a decimal integer string/,
    );
  });

  it("rejects an unknown status", () => {
    expect(() => parseStreamView(validStream({ status: "paused" }))).toThrow(
      /response\.status must be one of/,
    );
  });

  it("rejects a non-boolean cancelled flag", () => {
    expect(() => parseStreamView(validStream({ cancelled: "false" }))).toThrow(
      /response\.cancelled must be a boolean/,
    );
  });

  it("rejects a non-numeric progress", () => {
    expect(() => parseStreamView(validStream({ progress: "5000" }))).toThrow(
      /response\.progress must be a finite number/,
    );
  });

  it("uses the supplied path in the error message", () => {
    expect(() => parseStreamView(validStream({ id: 7 }), "response.streams[3]")).toThrow(
      /response\.streams\[3\]\.id must be a string/,
    );
  });

  it("truncates a long unexpected string in the error message", () => {
    const long = "x".repeat(200);
    expect(() => parseStreamView(validStream({ status: long }))).toThrow(/…/);
  });
});

describe("parseStreamListResponse", () => {
  it("accepts a well-formed envelope", () => {
    const page = { streams: [validStream()], total: 1, limit: 25, offset: 0 };
    expect(parseStreamListResponse(page)).toBe(page);
  });

  it("accepts an envelope without limit and offset", () => {
    expect(() => parseStreamListResponse({ streams: [], total: 0 })).not.toThrow();
  });

  it("accepts an envelope without total (omitted by backend when includeTotal is false)", () => {
    const page = { streams: [validStream()], limit: 25, offset: 0, nextCursor: "cur_123" };
    expect(parseStreamListResponse(page)).toBe(page);
  });

  it("rejects a non-string nextCursor", () => {
    expect(() => parseStreamListResponse({ streams: [], nextCursor: 123 })).toThrow(
      /response\.nextCursor must be a string/,
    );
  });

  it("rejects a missing streams array", () => {
    expect(() => parseStreamListResponse({ total: 0 })).toThrow(
      /response\.streams must be an array/,
    );
  });

  it("reports the index of the offending row", () => {
    const page = { streams: [validStream(), validStream({ vested: null })], total: 2 };
    expect(() => parseStreamListResponse(page)).toThrow(
      /response\.streams\[1\]\.vested must be a string/,
    );
  });

  it("rejects a non-numeric total", () => {
    expect(() => parseStreamListResponse({ streams: [], total: "0" })).toThrow(
      /response\.total must be a non-negative integer/,
    );
  });

  it("rejects a negative offset", () => {
    expect(() =>
      parseStreamListResponse({ streams: [], total: 0, offset: -1 }),
    ).toThrow(/response\.offset must be a non-negative integer/);
  });
});

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "0000000100000000-0001",
    kind: "created",
    streamId: "1",
    ledger: 1000,
    txHash: "1111111111111111111111111111111111111111111111111111111111111111",
    sender: "GAAA",
    recipient: "GBBB",
    token: "CCCC",
    totalAmount: "10000000",
    amount: null,
    recipientAmount: null,
    senderRefund: null,
    startTime: "100",
    endTime: "200",
    cliffTime: "100",
    closedAt: "100",
    ...overrides,
  };
}

describe("parseStreamEvent and parseStreamEvents", () => {
  it("accepts valid created, withdrawn, and cancelled events", () => {
    const events = [
      validEvent({ kind: "created" }),
      validEvent({
        eventId: "0000000100000100-0001",
        kind: "withdrawn",
        amount: "2500000",
        totalAmount: null,
      }),
      validEvent({
        eventId: "0000000100000200-0001",
        kind: "cancelled",
        recipientAmount: "2500000",
        senderRefund: "5000000",
        totalAmount: null,
      }),
    ];
    expect(parseStreamEvents(events)).toEqual(events);
  });

  it("skips unknown kinds and preserves the order of known events", () => {
    const created = validEvent({ kind: "created" });
    const withdrawn = validEvent({ kind: "withdrawn", eventId: "2" });
    const cancelled = validEvent({ kind: "cancelled", eventId: "3" });

    expect(parseStreamEvents([
      created,
      { kind: "paused" },
      withdrawn,
      { kind: "resumed" },
      cancelled,
    ])).toEqual([created, withdrawn, cancelled]);
  });

  it("rejects a non-array event history payload", () => {
    expect(() => parseStreamEvents({ events: [] })).toThrow(
      /response must be an array/,
    );
  });

  it("rejects an unknown event kind", () => {
    expect(() => parseStreamEvent(validEvent({ kind: "paused" }))).toThrow(
      /response\.kind must be one of created, withdrawn, cancelled/,
    );
  });

  it("rejects a negative ledger number", () => {
    expect(() => parseStreamEvent(validEvent({ ledger: -1 }))).toThrow(
      /response\.ledger must be a non-negative integer/,
    );
  });

  it("still rejects a malformed supported event after an unknown kind", () => {
    expect(() => parseStreamEvents([
      { kind: "paused" },
      validEvent({ kind: "withdrawn", ledger: -1 }),
    ])).toThrow(/response\[1\]\.ledger must be a non-negative integer/);
  });

  it("rejects an amount that is not a decimal integer string", () => {
    expect(() =>
      parseStreamEvents([validEvent(), validEvent({ amount: 500 })]),
    ).toThrow(/response\[1\]\.amount must be a string/);
  });
});
