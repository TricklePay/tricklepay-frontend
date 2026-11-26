import { describe, expect, it } from "vitest";

import {
  STREAM_CANCELLED_MESSAGE,
  STREAM_FULLY_WITHDRAWN_MESSAGE,
  STREAM_NOTHING_TO_WITHDRAW_MESSAGE,
  streamLockedUntilCliffMessage,
  streamNotStartedMessage,
} from "./stream-messages";

describe("STREAM_FULLY_WITHDRAWN_MESSAGE", () => {
  it("contains the expected wording for a fully withdrawn stream", () => {
    expect(STREAM_FULLY_WITHDRAWN_MESSAGE).toBe("Fully withdrawn.");
  });
});

describe("STREAM_CANCELLED_MESSAGE", () => {
  it("contains the expected wording for a cancelled stream", () => {
    expect(STREAM_CANCELLED_MESSAGE).toBe("This stream was cancelled.");
  });
});

describe("STREAM_NOTHING_TO_WITHDRAW_MESSAGE", () => {
  it("contains the expected wording when nothing is withdrawable", () => {
    expect(STREAM_NOTHING_TO_WITHDRAW_MESSAGE).toBe("Nothing to withdraw yet.");
  });
});

describe("streamNotStartedMessage", () => {
  it("interpolates the formatted start time", () => {
    expect(streamNotStartedMessage("Jan 1, 2026, 12:00 PM UTC")).toBe(
      "Starts Jan 1, 2026, 12:00 PM UTC.",
    );
  });

  it("produces a readable message with a real formatted date", () => {
    const message = streamNotStartedMessage("Dec 31, 2025, 11:59 PM EST");
    expect(message).toMatch(/^Starts /);
    expect(message).toContain("Dec 31, 2025, 11:59 PM EST");
    expect(message).toMatch(/\.$/);
  });
});

describe("streamLockedUntilCliffMessage", () => {
  it("interpolates the formatted cliff time", () => {
    expect(streamLockedUntilCliffMessage("Jan 15, 2026, 3:00 PM UTC")).toBe(
      "Locked until the cliff on Jan 15, 2026, 3:00 PM UTC.",
    );
  });

  it("produces a readable message with a real formatted date", () => {
    const message = streamLockedUntilCliffMessage("Feb 28, 2026, 6:30 PM PST");
    expect(message).toMatch(/^Locked until the cliff on /);
    expect(message).toContain("Feb 28, 2026, 6:30 PM PST");
    expect(message).toMatch(/\.$/);
  });

  it("includes the word cliff to explain the lock", () => {
    expect(streamLockedUntilCliffMessage("Jan 1, 2026, 12:00 PM UTC")).toMatch(/cliff/);
  });
});
