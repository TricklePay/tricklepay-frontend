import { describe, it, expect } from "vitest";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "./skeleton";

const pending = new Promise<never>(() => {});
function Pending(): never { throw pending; }

describe("Skeleton Loading States", () => {
  it("renders the skeleton while loading", () => {
    const html = renderToStaticMarkup(<Suspense fallback={<Skeleton />}><Pending /></Suspense>);
    expect(html).toContain('class="animate-pulse');
    expect(html).toContain('aria-hidden="true"');
  });
  it("renders available data instead of the fallback", () => {
    const html = renderToStaticMarkup(<Suspense fallback={<Skeleton />}><div id="data-loaded" /></Suspense>);
    expect(html).toContain('id="data-loaded"');
    expect(html).not.toContain("animate-pulse");
  });
});
