import { describe, expect, it } from "vitest";

import { STREAM_STATUS_META } from "@/lib/stream-status";
import type { StreamStatus } from "@/types/stream";

import { StreamStatusBadge } from "./stream-status-badge";

const STATUSES: StreamStatus[] = ["pending", "streaming", "completed", "cancelled"];

describe("StreamStatusBadge", () => {
  describe("colored variant (default)", () => {
    for (const status of STATUSES) {
      it(`renders ${status} with its icon, label, and per-status color classes`, () => {
        const el = StreamStatusBadge({ status });
        const json = JSON.stringify(el);
        expect(json).toContain(status);
        expect(json).toContain(STREAM_STATUS_META[status].icon);
        expect(json).toContain(STREAM_STATUS_META[status].style);
      });
    }

    it("merges an extra className onto the pill", () => {
      const el = StreamStatusBadge({ status: "streaming", className: "extra-class" });
      expect(JSON.stringify(el)).toContain("extra-class");
    });
  });

  describe("plain variant", () => {
    for (const status of STATUSES) {
      it(`renders ${status} without an icon or per-status color`, () => {
        const el = StreamStatusBadge({ status, variant: "plain" });
        const json = JSON.stringify(el);
        expect(json).toContain(status);
        expect(json).not.toContain(STREAM_STATUS_META[status].icon);
        expect(json).not.toContain(STREAM_STATUS_META[status].style);
      });
    }

    it("merges an extra className onto the pill", () => {
      const el = StreamStatusBadge({
        status: "cancelled",
        variant: "plain",
        className: "extra-class",
      });
      expect(JSON.stringify(el)).toContain("extra-class");
    });
  });
});
