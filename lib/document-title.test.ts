import { describe, expect, it } from "vitest";

import { pageDocumentTitle, streamDocumentTitle, UNSEEN_CHANGE_MARKER } from "@/lib/document-title";
import { STREAM_STATUS_META } from "@/lib/stream-status";
import type { StreamStatus } from "@/types/stream";

const STATUSES: StreamStatus[] = ["pending", "streaming", "completed", "cancelled"];

describe("streamDocumentTitle", () => {
  it("leads with the status glyph and label, then the stream and app name", () => {
    expect(streamDocumentTitle({ id: "42", status: "streaming" })).toBe(
      "● Streaming · Stream #42 — TricklePay",
    );
  });

  it.each(STATUSES)("uses the shared status metadata for %s", (status) => {
    const { icon, label } = STREAM_STATUS_META[status];
    expect(streamDocumentTitle({ id: "7", status })).toMatch(new RegExp(`^${icon} ${label} · `));
  });

  it("gives every status a distinct title", () => {
    const titles = STATUSES.map((status) => streamDocumentTitle({ id: "7", status }));
    expect(new Set(titles).size).toBe(STATUSES.length);
  });

  it("prepends the unseen-change marker only when asked", () => {
    const plain = streamDocumentTitle({ id: "7", status: "cancelled" });
    expect(plain.startsWith(UNSEEN_CHANGE_MARKER)).toBe(false);
    expect(streamDocumentTitle({ id: "7", status: "cancelled" }, true)).toBe(
      `${UNSEEN_CHANGE_MARKER} ${plain}`,
    );
  });
});

describe("pageDocumentTitle", () => {
  it("uses the same page-title pattern as metadata", () => {
    expect(pageDocumentTitle("New stream")).toBe("New stream — TricklePay");
  });
});
