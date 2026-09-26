import { describe, expect, it } from "vitest";

import { StreamTable } from "./stream-table";

describe("StreamTable", () => {
  it("renders the same default empty wording as the card list", () => {
    const output = JSON.stringify(StreamTable({ streams: [] }));

    expect(output).toContain("No streams yet.");
    expect(output).toContain('"colSpan":7');
  });

  it("accepts a contextual empty message", () => {
    const output = JSON.stringify(
      StreamTable({ streams: [], emptyMessage: "No incoming streams." }),
    );

    expect(output).toContain("No incoming streams.");
  });
});
