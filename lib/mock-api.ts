// Fixture data served by lib/api.ts when NEXT_PUBLIC_MOCK_API=true, so layout
// and styling work can happen with the client alone — no backend, no database.
//
// Times are generated relative to the moment the module loads, so every
// status stays meaningful however long ago the fixtures were written: the
// streaming stream is always mid-flight and visibly accruing.

import type { ListStreamsParams, StreamApiClient } from "@/lib/api";
import type { StreamListResponse, StreamView } from "@/types/stream";

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

/** Mock counterpart of `listStreams`, honouring status and paging. */
export const mockListStreams: StreamApiClient["listStreams"] = async (
  params: ListStreamsParams = {},
): Promise<StreamListResponse> => {
  const matches = MOCK_STREAMS.filter(
    (s) => !params.status || params.status === "all" || s.status === params.status,
  ).map((s) => asParty(s, params));
  const offset = params.offset ?? 0;
  const limit = params.limit ?? matches.length;
  return { streams: matches.slice(offset, offset + limit), total: matches.length, limit, offset };
};

/** Mock counterpart of `getStream`: null for an unknown id, like a 404. */
export const mockGetStream: StreamApiClient["getStream"] = async (
  id: string,
): Promise<StreamView | null> => {
  return MOCK_STREAMS.find((s) => s.id === id) ?? null;
};

// Mock client, typed against the same contract as the real client in
// `lib/api.ts` so a divergence fails the typecheck.
export const mockApiClient: StreamApiClient = {
  listStreams: mockListStreams,
  getStream: mockGetStream,
};
