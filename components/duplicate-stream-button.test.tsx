/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeFormDraft } from "@/lib/create-form-draft";
import { buildDuplicateDraft } from "@/lib/duplicate-stream";
import { axeViolations } from "@/test/axe";
import type { StreamView } from "@/types/stream";

import { DuplicateStreamButton } from "./duplicate-stream-button";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/create-form-draft", () => ({
  writeFormDraft: vi.fn(),
}));

const STREAM: StreamView = {
  id: "42",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: "10000000",
  withdrawn: "0",
  vested: "5000000",
  withdrawable: "5000000",
  locked: "5000000",
  startTime: "1700000000",
  endTime: "1700003600",
  cliffTime: "1700000000",
  cancelled: false,
  status: "streaming",
  progress: 5000,
};

describe("DuplicateStreamButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pushMock.mockReset();
    vi.mocked(writeFormDraft).mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("exposes an accessible name matching its visible text and a description via aria-describedby", () => {
    act(() => {
      root.render(<DuplicateStreamButton stream={STREAM} />);
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toBeNull();
    expect(button?.textContent?.trim()).toBe("Duplicate stream");

    const describedBy = button?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = describedBy ? document.getElementById(describedBy) : null;
    expect(description?.textContent?.trim()).toBe(
      "Open the create form prefilled with the same details.",
    );
  });

  it("saves the duplicate draft and navigates to /create when clicked", () => {
    act(() => {
      root.render(<DuplicateStreamButton stream={STREAM} />);
    });

    const button = container.querySelector("button");
    act(() => {
      button?.click();
    });

    expect(writeFormDraft).toHaveBeenCalledWith(buildDuplicateDraft(STREAM));
    expect(pushMock).toHaveBeenCalledWith("/create");
  });

  it("does nothing until clicked and writes the draft before navigating", () => {
    act(() => {
      root.render(<DuplicateStreamButton stream={STREAM} />);
    });

    expect(writeFormDraft).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    act(() => {
      container.querySelector("button")?.click();
    });

    expect(writeFormDraft).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeFormDraft).mock.invocationCallOrder[0]).toBeLessThan(
      pushMock.mock.invocationCallOrder[0],
    );
  });

  it("passes axe checks including label-content-name-mismatch", async () => {
    act(() => {
      root.render(<DuplicateStreamButton stream={STREAM} />);
    });

    expect(
      await axeViolations(container, [], ["label-content-name-mismatch"]),
    ).toEqual([]);
  });
});
