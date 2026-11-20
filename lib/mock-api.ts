// Fixture data served by lib/api.ts when NEXT_PUBLIC_MOCK_API=true, so layout
// and styling work can happen with the client alone — no backend, no database.
//
// Times are generated relative to the moment the module loads, so every
// status stays meaningful however long ago the fixtures were written: the
// streaming stream is always mid-flight and visibly accruing.

import type { ListStreamsParams, StreamApiClient } from "@/lib/api";
import type { StreamEvent, StreamListResponse, StreamView } from "@/types/stream";

const MOCK_SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const MOCK_RECIPIENT = "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const MOCK_TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

const HOUR = 3600;
const DAY = 24 * HOUR;
const now = Math.floor(Date.now() / 1000);

function fixture(
  id: string,
  status: StreamView["status"],
  totalAmount: bigint,
  startTime: number,
  endTime: number,
  withdrawn = 0n,
  vestedFraction = 0,
): StreamView {
  const vested = (totalAmount * BigInt(Math.round(vestedFraction * 10_000))) / 10_000n;
  const cancelled = status === "cancelled";
  return {
    id,
    sender: MOCK_SENDER,
    recipient: MOCK_RECIPIENT,
    token: MOCK_TOKEN,
    totalAmount: totalAmount.toString(),
    withdrawn: withdrawn.toString(),
    vested: vested.toString(),
    withdrawable: (vested - withdrawn).toString(),
    // For a cancelled stream this is the unvested remainder returned to the sender.
    locked: (totalAmount - vested).toString(),
    startTime: String(startTime),
    endTime: String(endTime),
    cliffTime: String(startTime),
    cancelled,
    status,
    progress: Math.round(vestedFraction * 10_000),
  };
}

const MOCK_STREAMS: StreamView[] = [
  fixture("1", "streaming", 1_000_0000000n, now - DAY, now + DAY, 200_0000000n, 0.5),
  fixture("2", "pending", 250_0000000n, now + 2 * DAY, now + 9 * DAY),
  fixture("3", "completed", 500_0000000n, now - 10 * DAY, now - 3 * DAY, 500_0000000n, 1),
  fixture("4", "cancelled", 750_0000000n, now - 5 * DAY, now + 5 * DAY, 100_0000000n, 0.3),
  fixture("5", "streaming", 12_345_6789012n, now - HOUR, now + 30 * DAY, 0n, 0.001),
];

// Stands in for the wallet's own address: whichever account the dashboard
// asks about sees every fixture, on both its incoming and outgoing side.
function asParty(stream: StreamView, params: ListStreamsParams): StreamView {
  return {
    ...stream,
    sender: params.sender ?? stream.sender,
    recipient: params.recipient ?? stream.recipient,
  };
}

/** Mock counterpart of `listStreams`, honouring paging. */
export const mockListStreams: StreamApiClient["listStreams"] = async (
  params: ListStreamsParams = {},
): Promise<StreamListResponse> => {
  const matches = MOCK_STREAMS.map((s) => asParty(s, params));
  const cursorIndex =
    params.cursor !== undefined ? matches.findIndex((s) => s.id === params.cursor) : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : (params.offset ?? 0);
  const limit = params.limit ?? matches.length;
  const pageStreams = matches.slice(start, start + limit);
  const hasNext = start + limit < matches.length && pageStreams.length > 0;
  const nextCursor = hasNext ? pageStreams[pageStreams.length - 1].id : undefined;
  return {
    streams: pageStreams,
    total: matches.length,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
    limit,
    offset: params.cursor !== undefined ? 0 : (params.offset ?? 0),
  };
};

/** Mock counterpart of `getStream`: null for an unknown id, like a 404. */
export const mockGetStream: StreamApiClient["getStream"] = async (
  id: string,
): Promise<StreamView | null> => {
  return MOCK_STREAMS.find((s) => s.id === id) ?? null;
};

const MOCK_EVENTS: Record<string, StreamEvent[]> = {
  "1": [
    {
      eventId: "0000000100000000-0001",
      kind: "created",
      streamId: "1",
      ledger: 1000,
      txHash: "1111111111111111111111111111111111111111111111111111111111111111",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      token: MOCK_TOKEN,
      totalAmount: (1_000_0000000n).toString(),
      startTime: String(now - DAY),
      endTime: String(now + DAY),
      cliffTime: String(now - DAY),
      closedAt: String(now - DAY),
    },
    {
      eventId: "0000000100000500-0001",
      kind: "withdrawn",
      streamId: "1",
      ledger: 1500,
      txHash: "2222222222222222222222222222222222222222222222222222222222222222",
      recipient: MOCK_RECIPIENT,
      amount: (200_0000000n).toString(),
      closedAt: String(now - 12 * HOUR),
    },
  ],
  "2": [
    {
      eventId: "0000000200000000-0001",
      kind: "created",
      streamId: "2",
      ledger: 2000,
      txHash: "3333333333333333333333333333333333333333333333333333333333333333",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      token: MOCK_TOKEN,
      totalAmount: (250_0000000n).toString(),
      startTime: String(now + 2 * DAY),
      endTime: String(now + 9 * DAY),
      cliffTime: String(now + 2 * DAY),
      closedAt: String(now - HOUR),
    },
  ],
  "3": [
    {
      eventId: "0000000300000000-0001",
      kind: "created",
      streamId: "3",
      ledger: 3000,
      txHash: "4444444444444444444444444444444444444444444444444444444444444444",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      token: MOCK_TOKEN,
      totalAmount: (500_0000000n).toString(),
      startTime: String(now - 10 * DAY),
      endTime: String(now - 3 * DAY),
      cliffTime: String(now - 10 * DAY),
      closedAt: String(now - 10 * DAY),
    },
    {
      eventId: "0000000300000900-0001",
      kind: "withdrawn",
      streamId: "3",
      ledger: 3900,
      txHash: "5555555555555555555555555555555555555555555555555555555555555555",
      recipient: MOCK_RECIPIENT,
      amount: (500_0000000n).toString(),
      closedAt: String(now - 3 * DAY),
    },
  ],
  "4": [
    {
      eventId: "0000000400000000-0001",
      kind: "created",
      streamId: "4",
      ledger: 4000,
      txHash: "6666666666666666666666666666666666666666666666666666666666666666",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      token: MOCK_TOKEN,
      totalAmount: (750_0000000n).toString(),
      startTime: String(now - 5 * DAY),
      endTime: String(now + 5 * DAY),
      cliffTime: String(now - 5 * DAY),
      closedAt: String(now - 5 * DAY),
    },
    {
      eventId: "0000000400000300-0001",
      kind: "withdrawn",
      streamId: "4",
      ledger: 4300,
      txHash: "7777777777777777777777777777777777777777777777777777777777777777",
      recipient: MOCK_RECIPIENT,
      amount: (100_0000000n).toString(),
      closedAt: String(now - 3 * DAY),
    },
    {
      eventId: "0000000400000600-0001",
      kind: "cancelled",
      streamId: "4",
      ledger: 4600,
      txHash: "8888888888888888888888888888888888888888888888888888888888888888",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      recipientAmount: (125_0000000n).toString(),
      senderRefund: (525_0000000n).toString(),
      closedAt: String(now - 2 * DAY),
    },
  ],
  "5": [
    {
      eventId: "0000000500000000-0001",
      kind: "created",
      streamId: "5",
      ledger: 5000,
      txHash: "9999999999999999999999999999999999999999999999999999999999999999",
      sender: MOCK_SENDER,
      recipient: MOCK_RECIPIENT,
      token: MOCK_TOKEN,
      totalAmount: (12_345_6789012n).toString(),
      startTime: String(now - HOUR),
      endTime: String(now + 30 * DAY),
      cliffTime: String(now - HOUR),
      closedAt: String(now - HOUR),
    },
  ],
};

/** Mock counterpart of `getStreamEvents`: returns the stream's event history in order. */
export const mockGetStreamEvents: StreamApiClient["getStreamEvents"] = async (
  id: string,
): Promise<StreamEvent[]> => {
  return MOCK_EVENTS[id] ?? [];
};

// Mock client, typed against the same contract as the real client in
// `lib/api.ts` so a divergence fails the typecheck.
export const mockApiClient: StreamApiClient = {
  listStreams: mockListStreams,
  getStream: mockGetStream,
  getStreamEvents: mockGetStreamEvents,
};
