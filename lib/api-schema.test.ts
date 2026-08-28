import { describe, expect, it } from "vitest";
import {
  ApiResponseError,
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

describe("parseStreamView", () => {
  it("returns the payload unchanged when it matches the contract", () => {
    const stream = validStream();
    expect(parseStreamView(stream)).toBe(stream);
  });

  it("accepts a payload without the optional cancelled flag", () => {
    const { cancelled: _cancelled, ...withoutFlag } = validStream();
    expect(() => parseStreamView(withoutFlag)).not.toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => parseStreamView(null)).toThrow(ApiResponseError);
    expect(() => parseStreamView([])).toThrow(/must be an object/);
  });

  it("rejects a missing string field and names it", () => {
    const { recipient: _recipient, ...withoutRecipient } = validStream();
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
