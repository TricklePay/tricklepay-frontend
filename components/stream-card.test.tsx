/* @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StreamView } from "@/types/stream";

import { StreamCard } from "./stream-card";

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
    const { container } = render(<StreamCard stream={{ ...baseStream, status: "pending" }} />);
    expect(container.textContent?.toLowerCase()).toContain("pending");
  });

  it("renders streaming status correctly", () => {
    const { container } = render(<StreamCard stream={{ ...baseStream, status: "streaming" }} />);
    expect(container.textContent?.toLowerCase()).toContain("streaming");
  });

  it("renders completed status correctly", () => {
    const { container } = render(<StreamCard stream={{ ...baseStream, status: "completed" }} />);
    expect(container.textContent?.toLowerCase()).toContain("completed");
  });

  it("renders cancelled status correctly", () => {
    const { container } = render(
      <StreamCard stream={{ ...baseStream, status: "cancelled", cancelled: true }} />,
    );
    expect(container.textContent?.toLowerCase()).toContain("cancelled");
  });
});
