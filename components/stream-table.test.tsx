import { describe, expect, it } from "vitest";

import type { StreamView } from "@/types/stream";

import { StreamCard } from "./stream-card";
import { StreamTable } from "./stream-table";

describe("StreamTable", () => {
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
    endTime: String(Math.floor(Date.now() / 1000) + 3600),
    cliffTime: "0",
    cancelled: false,
    status: "streaming",
    progress: 0,
  };

  it("renders the same default empty wording as the card list", () => {
    const output = JSON.stringify(StreamTable({ streams: [] }));

    expect(output).toContain("No streams yet.");
    expect(output).toContain('"colSpan":7');
  });

  it("accepts a contextual empty message", () => {
    const output = JSON.stringify(
      StreamTable({ streams: [], emptyMessage: "No incoming streams." }),
    );

    expect(output).toContain("No incoming streams.");
  });

  it("renders one row per stream", () => {
    const output = JSON.stringify(
      StreamTable({ streams: [baseStream, { ...baseStream, id: "456" }] }),
    );

    expect(output).toContain('"key":"123"');
    expect(output).toContain('"key":"456"');
  });

  it("links each row to the stream detail page", () => {
    const output = JSON.stringify(StreamTable({ streams: [baseStream] }));

    expect(output).toContain('"href":"/streams/123"');
  });

  it.each(["pending", "streaming", "completed", "cancelled"] as const)(
    "renders the %s status",
    (status) => {
      const output = JSON.stringify(
        StreamTable({ streams: [{ ...baseStream, status }] }),
      );

      expect(output).toContain(status);
    },
  );

  it.each(["streaming", "pending"] as const)(
    "shows remaining time for a %s stream",
    (status) => {
      const output = JSON.stringify(
        StreamTable({ streams: [{ ...baseStream, status }] }),
      );

      expect(output).toContain("ends in");
    },
  );

  it.each(["completed", "cancelled"] as const)(
    "shows a dash instead of remaining time for a %s stream",
    (status) => {
      const el = StreamTable({ streams: [{ ...baseStream, status }] });
      const tbody = el.props.children.props.children[1];
      const row = tbody.props.children[0];
      const remainingCell = row.props.children[6];

      expect(remainingCell.props.children).toBe("—");
    },
  );

  it("renders the same truncated addresses, amounts, and status as the card view for the same stream", () => {
    const tableOutput = JSON.stringify(StreamTable({ streams: [baseStream] }));
    const cardOutput = JSON.stringify(StreamCard({ stream: baseStream }));

    // From/To addresses
    expect(tableOutput).toContain("GAAZ...VKOC");
    expect(cardOutput).toContain("GAAZ...VKOC");
    expect(tableOutput).toContain("GBBZ...VKOC");
    expect(cardOutput).toContain("GBBZ...VKOC");

    // Status wording
    expect(tableOutput).toContain(baseStream.status);
    expect(cardOutput).toContain(baseStream.status);
  });
});
