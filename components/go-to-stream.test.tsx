/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GoToStream } from "./go-to-stream";

describe("GoToStream", () => {
  it("renders the stream ID input", () => {
    render(<GoToStream onGo={vi.fn()} />);
    expect(screen.getByPlaceholderText("Go to stream ID…")).toBeTruthy();
  });

  it("calls onGo with the stream href when the form is submitted", () => {
    const onGo = vi.fn();
    render(<GoToStream onGo={onGo} />);

    const input = screen.getByPlaceholderText("Go to stream ID…");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.submit(input.closest("form")!);

    expect(onGo).toHaveBeenCalledWith("/streams/42");
  });

  it("does not call onGo when the input is empty", () => {
    const onGo = vi.fn();
    render(<GoToStream onGo={onGo} />);

    fireEvent.submit(screen.getByPlaceholderText("Go to stream ID…").closest("form")!);

    expect(onGo).not.toHaveBeenCalled();
  });

  describe("mobile keyboard / autocorrect attributes (#685)", () => {
    it("stream ID input has spellCheck=false, autoCapitalize=off, autoComplete=off", () => {
      render(<GoToStream onGo={vi.fn()} />);

      const input = screen.getByPlaceholderText("Go to stream ID…") as HTMLInputElement;

      expect(input.getAttribute("spellcheck")).toBe("false");
      expect(input.getAttribute("autocapitalize")).toBe("off");
      expect(input.getAttribute("autocomplete")).toBe("off");
    });

    it("stream ID input keeps inputMode=numeric", () => {
      render(<GoToStream onGo={vi.fn()} />);

      const input = screen.getByPlaceholderText("Go to stream ID…") as HTMLInputElement;

      expect(input.getAttribute("inputmode")).toBe("numeric");
    });
  });
});
