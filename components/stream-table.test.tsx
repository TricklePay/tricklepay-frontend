/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { truncateAddress } from "@/lib/format";
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
    const { container } = render(<StreamTable streams={[]} />);

    expect(screen.getByText("No streams yet.")).toBeDefined();
    const td = container.querySelector("td");
    expect(td?.getAttribute("colspan")).toBe("7");
  });

  it("accepts a contextual empty message", () => {
    render(
      <StreamTable streams={[]} emptyMessage="No incoming streams." />,
    );

    expect(screen.getByText("No incoming streams.")).toBeDefined();
  });

  it("renders one row per stream", () => {
    render(
      <StreamTable streams={[baseStream, { ...baseStream, id: "456" }]} />,
    );

    expect(screen.getByText("#123")).toBeDefined();
    expect(screen.getByText("#456")).toBeDefined();
  });

  it("links each row to the stream detail page", () => {
    render(<StreamTable streams={[baseStream]} />);

    const link = screen.getByRole("link", { name: "#123" });
    expect(link.getAttribute("href")).toBe("/streams/123");
  });

  it.each(["pending", "streaming", "completed", "cancelled"] as const)(
    "renders the %s status",
    (status) => {
      const { container } = render(
        <StreamTable streams={[{ ...baseStream, status }]} />,
      );

      expect(container.textContent?.toLowerCase()).toContain(status);
    },
  );

  it.each(["streaming", "pending"] as const)(
    "shows remaining time for a %s stream",
    (status) => {
      const { container } = render(
        <StreamTable streams={[{ ...baseStream, status }]} />,
      );

      expect(container.textContent).toContain("ends in");
    },
  );

  it.each(["completed", "cancelled"] as const)(
    "shows a dash instead of remaining time for a %s stream",
    (status) => {
      const { container } = render(
        <StreamTable streams={[{ ...baseStream, status }]} />,
      );
      const row = container.querySelector("tbody tr");
      const cells = row?.querySelectorAll("td");
      expect(cells?.[6]?.textContent).toBe("—");
    },
  );

  it("renders the same truncated addresses, amounts, and status as the card view for the same stream", () => {
    const { container: tableContainer } = render(
      <StreamTable streams={[baseStream]} />,
    );
    const { container: cardContainer } = render(
      <StreamCard stream={baseStream} />,
    );

    const tableOutput = tableContainer.textContent ?? "";
    const cardOutput = cardContainer.textContent ?? "";

    const sender = truncateAddress(baseStream.sender);
    const recipient = truncateAddress(baseStream.recipient);

    // From/To addresses
    expect(tableOutput).toContain(sender);
    expect(cardOutput).toContain(sender);
    expect(tableOutput).toContain(recipient);
    expect(cardOutput).toContain(recipient);

    // Status wording
    expect(tableOutput.toLowerCase()).toContain(baseStream.status);
    expect(cardOutput.toLowerCase()).toContain(baseStream.status);
  });
});
