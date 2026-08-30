import { describe, it, expect } from "vitest";
import { StreamCard } from "./stream-card";
import type { StreamView } from "@/types/stream";

describe("StreamCard", () => {
  const baseStream: StreamView = {
    id: "123",
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
  };

  it("renders pending status correctly", () => {
    const el = StreamCard({ stream: { ...baseStream, status: "pending" } });
    expect(JSON.stringify(el)).toContain("pending");
  });

  it("renders streaming status correctly", () => {
    const el = StreamCard({ stream: { ...baseStream, status: "streaming" } });
    expect(JSON.stringify(el)).toContain("streaming");
  });

  it("renders completed status correctly", () => {
    const el = StreamCard({ stream: { ...baseStream, status: "completed" } });
    expect(JSON.stringify(el)).toContain("completed");
  });

  it("renders cancelled status correctly", () => {
    const el = StreamCard({ stream: { ...baseStream, status: "cancelled", cancelled: true } });
    expect(JSON.stringify(el)).toContain("cancelled");
  });
});
