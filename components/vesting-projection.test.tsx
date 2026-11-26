/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { fireEvent } from "@testing-library/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearTokenDecimalsCache, setCachedTokenDecimals } from "@/lib/token-decimals";
import { parseDatetimeLocal } from "@/lib/vesting-projection";
import type { StreamView } from "@/types/stream";

import { VestingProjection } from "./vesting-projection";

// Pass-through by default. A datetime-local input clears any text it cannot
// parse, so the invalid-date message is only reachable by making the parser
// reject an otherwise valid value.
vi.mock("@/lib/vesting-projection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vesting-projection")>();
  return { ...actual, parseDatetimeLocal: vi.fn(actual.parseDatetimeLocal) };
});

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const START = 1_700_000_000;
const END = START + 100;

// 100 tokens at 7 decimals, vesting linearly over 100 seconds with no cliff.
const STREAM: StreamView = {
  id: "1",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: TOKEN,
  totalAmount: "1000000000",
  withdrawn: "0",
  vested: "0",
  withdrawable: "0",
  locked: "1000000000",
  startTime: String(START),
  endTime: String(END),
  cliffTime: String(START),
  cancelled: false,
  status: "streaming",
  progress: 0,
};

// A datetime-local value is local wall-clock time, so build it from the local
// date parts to stay independent of the machine's time zone.
function localInput(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

describe("VestingProjection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("@/lib/vesting-projection")>(
      "@/lib/vesting-projection",
    );
    vi.mocked(parseDatetimeLocal).mockReset().mockImplementation(actual.parseDatetimeLocal);
    clearTokenDecimalsCache();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    clearTokenDecimalsCache();
  });

  function render(stream: StreamView) {
    act(() => {
      root.render(<VestingProjection stream={stream} />);
    });
  }

  function dateInput(): HTMLInputElement {
    const input = container.querySelector("input");
    if (!input) throw new Error("The date input was not rendered.");
    return input;
  }

  function enter(value: string) {
    fireEvent.change(dateInput(), { target: { value } });
  }

  function shown(label: string): string | undefined {
    const term = Array.from(container.querySelectorAll("dt")).find(
      (element) => element.textContent === label,
    );
    return term?.nextElementSibling?.textContent ?? undefined;
  }

  it("shows no result and no error until a date is entered", () => {
    render(STREAM);

    expect(container.querySelector("dl")).toBeNull();
    expect(container.textContent).not.toContain("Invalid date.");
  });

  it("vests nothing for a date before the start", () => {
    render(STREAM);

    enter(localInput(START - 3600));

    expect(shown("Context")).toContain("nothing vested yet");
    expect(shown("Vested at that time")).toBe("0");
    expect(shown("Withdrawable at that time")).toBe("0");
  });

  it("vests proportionally for a date inside the stream", () => {
    render(STREAM);

    enter(localInput(START + 50));

    expect(shown("Context")).toBe("During the stream.");
    expect(shown("Vested at that time")).toBe("50");
    expect(shown("Withdrawable at that time")).toBe("50");
  });

  it.each([
    { label: "at the end", unix: END },
    { label: "after the end", unix: END + 3600 },
  ])("is fully vested $label", ({ unix }) => {
    render(STREAM);

    enter(localInput(unix));

    expect(shown("Context")).toContain("fully vested");
    expect(shown("Vested at that time")).toBe("100");
    expect(shown("Withdrawable at that time")).toBe("100");
  });

  it("subtracts what was already withdrawn from the withdrawable amount", () => {
    render({ ...STREAM, withdrawn: "250000000" });

    enter(localInput(START + 50));
    expect(shown("Vested at that time")).toBe("50");
    expect(shown("Withdrawable at that time")).toBe("25");

    enter(localInput(END + 3600));
    expect(shown("Vested at that time")).toBe("100");
    expect(shown("Withdrawable at that time")).toBe("75");
  });

  it("shows the invalid date message instead of amounts when the input cannot be parsed", () => {
    vi.mocked(parseDatetimeLocal).mockReturnValue(null);
    render(STREAM);

    enter(localInput(START + 50));

    expect(container.textContent).toContain("Invalid date.");
    expect(container.querySelector("dl")).toBeNull();
  });

  it("clears the result and the message when the input is emptied", () => {
    render(STREAM);

    enter(localInput(START + 50));
    expect(container.querySelector("dl")).not.toBeNull();

    enter("");
    expect(container.querySelector("dl")).toBeNull();
    expect(container.textContent).not.toContain("Invalid date.");
  });

  it.each([
    { decimals: 6, total: "100000000", expected: "100" },
    { decimals: 0, total: "100", expected: "100" },
    { decimals: 9, total: "100000000000", expected: "100" },
    { decimals: 2, total: "12345", expected: "123.45" },
  ])("formats amounts with the token's $decimals decimals", ({ decimals, total, expected }) => {
    setCachedTokenDecimals(TOKEN, decimals);
    render({ ...STREAM, totalAmount: total, locked: total });

    enter(localInput(END + 3600));

    expect(shown("Vested at that time")).toBe(expected);
    expect(shown("Withdrawable at that time")).toBe(expected);
  });

  it("falls back to 7 decimals when the token's decimals are not known yet", () => {
    render(STREAM);

    enter(localInput(END + 3600));

    expect(shown("Vested at that time")).toBe("100");
  });
});
