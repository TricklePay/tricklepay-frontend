import { describe, expect, it } from "vitest";

import type { StreamView } from "@/types/stream";

import { isSameAddress, isStreamRecipient, isStreamSender } from "./stream-role";

// Why strict equality matters: the contract authorises cancel and withdraw
// with `require_auth` on the stream's stored sender / recipient address (see
// the note on code 2 in lib/contract-errors.ts: require_auth aborts before
// the contract could return Unauthorized). Strkeys are case-sensitive, so a
// wallet address that differs in case or has stray whitespace is a different
// party on-chain. The UI must treat it as "not that party" too, otherwise the
// cancel/withdraw controls would show for a wallet the contract will reject.

const SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF";

const stream = { sender: SENDER, recipient: RECIPIENT } as StreamView;

describe("isSameAddress", () => {
  it("is true for the exact same address", () => {
    expect(isSameAddress(SENDER, SENDER)).toBe(true);
  });

  it("is false for different addresses", () => {
    expect(isSameAddress(SENDER, RECIPIENT)).toBe(false);
  });

  it("is false when only the case differs", () => {
    expect(isSameAddress(SENDER, SENDER.toLowerCase())).toBe(false);
  });

  it("is false when either side is padded with whitespace", () => {
    expect(isSameAddress(` ${SENDER}`, SENDER)).toBe(false);
    expect(isSameAddress(SENDER, `${SENDER} `)).toBe(false);
    expect(isSameAddress(`${SENDER}\n`, SENDER)).toBe(false);
  });

  it("is false when either side is null or undefined", () => {
    expect(isSameAddress(null, SENDER)).toBe(false);
    expect(isSameAddress(SENDER, null)).toBe(false);
    expect(isSameAddress(undefined, SENDER)).toBe(false);
    expect(isSameAddress(SENDER, undefined)).toBe(false);
  });

  it("is false when both sides are null or undefined", () => {
    expect(isSameAddress(null, null)).toBe(false);
    expect(isSameAddress(undefined, undefined)).toBe(false);
    expect(isSameAddress(null, undefined)).toBe(false);
  });
});

describe("isStreamSender", () => {
  it("is true only for the exact sender address", () => {
    expect(isStreamSender(stream, SENDER)).toBe(true);
    expect(isStreamSender(stream, RECIPIENT)).toBe(false);
  });

  it("is false for a different-case, padded or missing wallet address", () => {
    expect(isStreamSender(stream, SENDER.toLowerCase())).toBe(false);
    expect(isStreamSender(stream, ` ${SENDER} `)).toBe(false);
    expect(isStreamSender(stream, null)).toBe(false);
  });
});

describe("isStreamRecipient", () => {
  it("is true only for the exact recipient address", () => {
    expect(isStreamRecipient(stream, RECIPIENT)).toBe(true);
    expect(isStreamRecipient(stream, SENDER)).toBe(false);
  });

  it("is false for a different-case, padded or missing wallet address", () => {
    expect(isStreamRecipient(stream, RECIPIENT.toLowerCase())).toBe(false);
    expect(isStreamRecipient(stream, `${RECIPIENT} `)).toBe(false);
    expect(isStreamRecipient(stream, null)).toBe(false);
  });

  it("does not treat a self-stream's sender role as a different role", () => {
    const selfStream = { sender: SENDER, recipient: SENDER } as StreamView;
    expect(isStreamSender(selfStream, SENDER)).toBe(true);
    expect(isStreamRecipient(selfStream, SENDER)).toBe(true);
  });
});
