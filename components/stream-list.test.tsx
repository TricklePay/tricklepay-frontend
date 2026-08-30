import { describe, it, expect } from "vitest";
import { StreamList } from "./stream-list";

describe("StreamList", () => {
  it("renders the default empty state when no streams are provided", () => {
    const el = StreamList({ streams: [] });
    const json = JSON.stringify(el);
    expect(json).toContain("No streams yet.");
  });

  it("renders a custom empty message when provided", () => {
    const el = StreamList({ streams: [], emptyMessage: "Nothing to show here." });
    const json = JSON.stringify(el);
    expect(json).toContain("Nothing to show here.");
    expect(json).not.toContain("No streams yet.");
  });

  it("does not render the create link by default in the empty state", () => {
    const el = StreamList({ streams: [] });
    const json = JSON.stringify(el);
    expect(json).not.toContain("Create a stream");
  });

  it("renders the create link when showCreateLink is true and the list is empty", () => {
    const el = StreamList({ streams: [], showCreateLink: true });
    const json = JSON.stringify(el);
    expect(json).toContain("Create a stream");
  });
});
