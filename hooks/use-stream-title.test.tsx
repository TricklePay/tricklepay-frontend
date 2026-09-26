/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { streamDocumentTitle } from "@/lib/document-title";
import type { StreamView } from "@/types/stream";

import { useStreamTitle } from "./use-stream-title";

const STREAM = { id: "42", status: "streaming" } as Pick<StreamView, "id" | "status">;

describe("useStreamTitle", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderTitle(stream: Pick<StreamView, "id" | "status"> | null, streamId: string) {
    function Probe() {
      useStreamTitle(stream, streamId);
      return null;
    }
    return act(async () => {
      root.render(<Probe />);
    });
  }

  beforeEach(() => {
    document.title = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    try {
      act(() => root.unmount());
    } catch {
      // Already unmounted inside the test (restore path) — nothing to do.
    }
    container.remove();
  });

  it("sets the title to reflect the stream being viewed", async () => {
    await renderTitle(STREAM, "42");

    expect(document.title).toBe(streamDocumentTitle(STREAM));
  });

  it("restores the previous title on unmount", async () => {
    document.title = "TricklePay dashboard";

    await renderTitle(STREAM, "42");
    expect(document.title).toBe(streamDocumentTitle(STREAM));

    await act(async () => {
      root.unmount();
    });

    expect(document.title).toBe("TricklePay dashboard");
  });
});
