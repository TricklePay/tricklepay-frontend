import { describe, expect, it } from "vitest";

import type { StreamView } from "@/types/stream";

import { canSenderCancel } from "./stream-actions";

const stream = {
  id: "1",
  sender: "G-SENDER",
  recipient: "G-RECIPIENT",
  status: "streaming",
} as StreamView;

describe("canSenderCancel", () => {
  it("allows the sender to cancel an active stream", () => {
    expect(canSenderCancel(stream, stream.sender)).toBe(true);
  });

  it("does not allow the recipient to cancel", () => {
    expect(canSenderCancel(stream, stream.recipient)).toBe(false);
  });

  it("does not allow cancellation after completion", () => {
    expect(canSenderCancel({ ...stream, status: "completed" }, stream.sender)).toBe(false);
  });

  it("does not allow cancellation when there is no connected wallet", () => {
    expect(canSenderCancel(stream, null)).toBe(false);
  });

  // The comparison a wrong-account mistake would slip through: any deviation
  // from the sender's exact address — case, whitespace, or otherwise — must
  // read as "not the sender," never as a near-enough match.
  describe("address comparison", () => {
    it("is case-sensitive", () => {
      expect(canSenderCancel(stream, stream.sender.toLowerCase())).toBe(false);
    });

    it("does not trim or otherwise normalise whitespace", () => {
      expect(canSenderCancel(stream, ` ${stream.sender}`)).toBe(false);
      expect(canSenderCancel(stream, `${stream.sender} `)).toBe(false);
    });

    it("is consistent across repeated calls with the same inputs", () => {
      const results = Array.from({ length: 5 }, () => canSenderCancel(stream, stream.sender));
      expect(results).toEqual([true, true, true, true, true]);
    });

    it("matches on value, not on how the string was built", () => {
      // Reassembled via concatenation rather than copied whole, so this
      // exercises value equality rather than relying on both sides
      // happening to be the same in-memory string.
      const reassembled = stream.sender.slice(0, 2) + stream.sender.slice(2);
      expect(canSenderCancel(stream, reassembled)).toBe(true);
    });
  });
});
