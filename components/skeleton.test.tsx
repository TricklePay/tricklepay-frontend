import React, { Suspense } from "react";
import type { ReactElement, ReactNode } from "react";
import { describe, it, expect } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton Loading States", () => {
  it("renders the skeleton while loading", () => {
    const fallback = Skeleton({});
    const tree = React.createElement(Suspense, { fallback }, null) as ReactElement<{
      fallback: typeof fallback;
      children: ReactNode;
    }>;
    expect(tree.props.fallback.props.className).toContain("animate-pulse");
    expect(tree.props.fallback.props["aria-hidden"]).toBe("true");
  });

  it("is replaced once data arrives", () => {
    const fallback = Skeleton({});
    const dataElement = React.createElement("div", { id: "data-loaded" });
    const tree = React.createElement(Suspense, { fallback }, dataElement) as ReactElement<{
      fallback: typeof fallback;
      children: typeof dataElement;
    }>;

    expect(tree.props.children).toBe(dataElement);
    expect(tree.props.children.props.id).toBe("data-loaded");
  });
});
