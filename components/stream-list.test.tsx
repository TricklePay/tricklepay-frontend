import { describe, it, expect } from "vitest";
import { StreamList } from "./stream-list";
import type { StreamView } from "@/types/stream";

function makeStream(overrides: Partial<StreamView> & { id: string }): StreamView {
  return {
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: "USDC",
    totalAmount: "1000",
    withdrawn: "0",
    vested: "0",
    withdrawable: "0",
    locked: "1000",
    startTime: "1600000000",
    endTime: "1600003600",
    cliffTime: "0",
    cancelled: false,
    status: "streaming",
    progress: 0,
    ...overrides,
  };
}

describe("StreamList", () => {
  it("renders one card per stream when fewer than 5 streams", () => {
    const streams = [
      makeStream({ id: "100" }),
      makeStream({ id: "200" }),
      makeStream({ id: "300" }),
    ];
    const el = StreamList({ streams });
    const json = JSON.stringify(el);
    expect(json).toContain("#100");
    expect(json).toContain("#200");
    expect(json).toContain("#300");
  });

  it("uses more than one stream in the assertion", () => {
    const streams = [makeStream({ id: "A" }), makeStream({ id: "B" })];
    const el = StreamList({ streams });
    const json = JSON.stringify(el);
    expect(json).toContain("#A");
    expect(json).toContain("#B");
  });
});
