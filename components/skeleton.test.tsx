/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import React, { Suspense } from "react";
import { Skeleton } from "./skeleton";

describe("Skeleton Loading States", () => {
  it("renders the skeleton while loading", () => {
    const fallback = Skeleton({}) as any;
    const tree = Suspense({ fallback, children: null }) as any;
    expect(tree.props.fallback.props.className).toContain("animate-pulse");
    expect(tree.props.fallback.props["aria-hidden"]).toBe("true");
  });

  it("is replaced once data arrives", () => {
    const fallback = Skeleton({}) as any;
    const dataElement = React.createElement("div", { id: "data-loaded" });
    const tree = Suspense({ fallback, children: dataElement }) as any;

    expect(tree.props.children).toBe(dataElement);
    expect(tree.props.children.props.id).toBe("data-loaded");
  });
});
