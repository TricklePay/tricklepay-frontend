/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StreamList } from "./stream-list";

describe("StreamList", () => {
  it("renders the default empty state when no streams are provided", () => {
    render(<StreamList streams={[]} />);
    expect(screen.getByText("No streams yet.")).toBeDefined();
  });

  it("renders a custom empty message when provided", () => {
    render(<StreamList streams={[]} emptyMessage="Nothing to show here." />);
    expect(screen.getByText("Nothing to show here.")).toBeDefined();
    expect(screen.queryByText("No streams yet.")).toBeNull();
  });

  it("does not render the create link by default in the empty state", () => {
    render(<StreamList streams={[]} />);
    expect(screen.queryByRole("link", { name: /create a stream/i })).toBeNull();
  });

  it("renders the create link when showCreateLink is true and the list is empty", () => {
    render(<StreamList streams={[]} showCreateLink={true} />);
    const link = screen.getByRole("link", { name: /create a stream/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/create");
  });
});
