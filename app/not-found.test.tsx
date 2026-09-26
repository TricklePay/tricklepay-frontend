import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders its message", () => {
    const json = JSON.stringify(NotFound());
    expect(json).toContain("Page not found");
    expect(json).toContain("doesn");
  });

  it("offers a link back to the stream list", () => {
    const json = JSON.stringify(NotFound());
    expect(json).toContain("Go to your streams");
    expect(json).toContain('"href":"/"');
  });
});
