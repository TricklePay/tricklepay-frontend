// A fake Soroban RPC and backend API, served through Playwright request
// interception.
//
// The app's write path (lib/contract.ts) makes four RPC calls per invocation:
// getLedgerEntries (via getAccount), simulateTransaction (via
// prepareTransaction), sendTransaction, then getTransaction until it settles.
// The simulation response has to carry real SorobanTransactionData, because
// assembleTransaction parses it and applies it to the transaction — a
// hand-written placeholder fails to decode. It is built here with the SDK so it
// stays valid rather than being pasted in as an opaque fixture.
//
// What is stubbed:
// - Soroban RPC interactions (`simulateTransaction`, `sendTransaction`, etc.).
// - The backend API for listing and fetching streams.
//
// What is not stubbed:
// - Real smart contract execution (no read/write sets are applied).
// - Validations of the submitted transaction envelope (the signature is ignored).
// - Horizon requests (which the app does not make directly).

import type { Page, Route } from "@playwright/test";
import { Keypair, xdr } from "@stellar/stellar-sdk";

import type { StreamEvent, StreamView } from "../../types/stream";

export const RPC_URL = "http://localhost:8000/soroban/rpc";
export const API_URL = "http://localhost:3000";
export const CONTRACT_ID = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";
export const TOKEN_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const TX_HASH = "b9d5f2e1c7a04c8e9f3b1d6a5e8c2f7b4a9d0e3c6b8f1a4d7e0c3b6a9f2e5d8c";

// A minimal but structurally valid Soroban footprint. Empty read/write sets are
// legal: nothing here executes the contract, it only has to decode.
function sorobanTransactionData(): string {
  const data = new xdr.SorobanTransactionData({
    ext: new xdr.SorobanTransactionDataExt(0),
    resources: new xdr.SorobanResources({
      footprint: new xdr.LedgerFootprint({ readOnly: [], readWrite: [] }),
      instructions: 0,
      diskReadBytes: 0,
      writeBytes: 0,
    }),
    resourceFee: new xdr.Int64(0),
  });
  return data.toXDR("base64");
}

// The account entry getAccount reads to pick up a sequence number.
function accountEntryXdr(address: string, sequence: string): string {
  // `LedgerEntryData.account` is a static factory, not a constructor, and
  // `SequenceNumber` is a type alias for Int64 rather than a class of its own.
  const entry = xdr.LedgerEntryData.account(
    new xdr.AccountEntry({
      accountId: Keypair.fromPublicKey(address).xdrAccountId(),
      balance: new xdr.Int64(1_000_000_000),
      seqNum: xdr.Int64.fromString(sequence),
      numSubEntries: 0,
      inflationDest: null,
      flags: 0,
      homeDomain: "",
      thresholds: Buffer.alloc(4),
      signers: [],
      ext: new xdr.AccountEntryExt(0),
    }),
  );
  return entry.toXDR("base64");
}

// The matching ledger key. The SDK's parser rejects an entry without one, so it
// cannot be left blank.
function accountKeyXdr(address: string): string {
  const key = xdr.LedgerKey.account(
    new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(address).xdrPublicKey() }),
  );
  return key.toXDR("base64");
}

// The SDK parses a successful getTransaction in full — envelope, result, and
// meta are all decoded before the app ever sees `status`. They have to be real
// XDR, so they are built here rather than stubbed as placeholder strings.
function transactionResultXdr(): string {
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txSuccess([]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR("base64");
}

// Meta v0: the parser's sorobanMeta branch is only taken for v3/v4, so this
// needs no return value.
function transactionMetaXdr(): string {
  return new xdr.TransactionMeta(0, []).toXDR("base64");
}

interface JsonRpcRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface ChainStubOptions {
  address: string;
  /** Sequence number reported for the account. */
  sequence?: string;
  /** Statuses returned by successive getTransaction calls. */
  confirmationStatuses?: Array<"PENDING" | "SUCCESS">;
  /**
   * When set, simulateTransaction reports this as a simulation failure
   * (`{ error: simulationError }`) instead of succeeding. This is what
   * prepareTransaction throws verbatim (`new Error(simResponse.error)`), so
   * the string should look like a real Soroban failure — typically an
   * "Error(Contract, #N)" token, optionally attributed to a contract via a
   * "contract:C…, topics:[error, Error(Contract, #N)]" diagnostic line. See
   * lib/contract-errors.ts's parseContractError, which reads exactly that
   * shape back out.
   */
  simulationError?: string;
}

// Records what the app asked the chain to do, for assertions.
export interface ChainCalls {
  methods: string[];
  sendCount: number;
  /** The most recent signed envelope the app submitted. */
  lastEnvelope?: string;
}

export async function stubChain(page: Page, options: ChainStubOptions): Promise<ChainCalls> {
  const calls: ChainCalls = { methods: [], sendCount: 0 };
  const sequence = options.sequence ?? "1234567890";

  await page.route(`${RPC_URL}**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders() });
    }

    const body = request.postDataJSON() as JsonRpcRequest | JsonRpcRequest[];
    const single = Array.isArray(body) ? body[0] : body;
    calls.methods.push(single.method);

    const result = rpcResult(single, {
      address: options.address,
      sequence,
      calls,
      confirmationStatuses: options.confirmationStatuses,
      simulationError: options.simulationError,
    });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ jsonrpc: "2.0", id: single.id, result }),
    });
  });

  return calls;
}

function rpcResult(
  request: JsonRpcRequest,
  ctx: {
    address: string;
    sequence: string;
    calls: ChainCalls;
    confirmationStatuses?: Array<"PENDING" | "SUCCESS">;
    simulationError?: string;
  },
): unknown {
  switch (request.method) {
    case "getLatestLedger":
      return { id: "ledger", protocolVersion: 22, sequence: 1000 };

    case "getLedgerEntries":
      return {
        latestLedger: 1000,
        entries: [
          {
            key: accountKeyXdr(ctx.address),
            xdr: accountEntryXdr(ctx.address, ctx.sequence),
            lastModifiedLedgerSeq: 1000,
          },
        ],
      };

    case "simulateTransaction":
      if (ctx.simulationError) {
        // The shape prepareTransaction checks for (Api.isSimulationError:
        // `"error" in sim`) before throwing `new Error(sim.error)` verbatim.
        return { latestLedger: 1000, events: [], error: ctx.simulationError };
      }
      return {
        latestLedger: 1000,
        minResourceFee: "100",
        transactionData: sorobanTransactionData(),
        // No auth entries: assembleTransaction applies an empty list, which is
        // what a source-account-authorised invocation looks like.
        results: [{ auth: [], xdr: scValVoid() }],
        events: [],
      };

    case "sendTransaction": {
      ctx.calls.sendCount += 1;
      // Keep the envelope the app actually signed; getTransaction echoes it
      // back, so the confirmation reflects the real submitted transaction.
      const envelope = (request.params as { transaction?: string } | undefined)?.transaction;
      if (typeof envelope === "string") ctx.calls.lastEnvelope = envelope;
      return { status: "PENDING", hash: TX_HASH, latestLedger: 1000, latestLedgerCloseTime: "0" };
    }

    case "getTransaction": {
      const attempt = ctx.calls.methods.filter((method) => method === "getTransaction").length - 1;
      const status = ctx.confirmationStatuses?.[attempt] ?? "SUCCESS";
      if (status === "PENDING") {
        return {
          status,
          latestLedger: 1000,
          latestLedgerCloseTime: "0",
          oldestLedger: 1,
          oldestLedgerCloseTime: "0",
          txHash: TX_HASH,
          ledger: 1001,
          createdAt: "0",
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: ctx.calls.lastEnvelope,
          resultXdr: transactionResultXdr(),
          resultMetaXdr: transactionMetaXdr(),
        };
      }
      return {
        status,
        latestLedger: 1001,
        latestLedgerCloseTime: "0",
        oldestLedger: 1,
        oldestLedgerCloseTime: "0",
        txHash: TX_HASH,
        ledger: 1001,
        createdAt: "0",
        applicationOrder: 1,
        feeBump: false,
        envelopeXdr: ctx.calls.lastEnvelope,
        resultXdr: transactionResultXdr(),
        resultMetaXdr: transactionMetaXdr(),
      };
    }

    default:
      return {};
  }
}

function scValVoid(): string {
  return xdr.ScVal.scvVoid().toXDR("base64");
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

// ---------------------------------------------------------------------------
// Backend read API
// ---------------------------------------------------------------------------

/**
 * Query parameters accepted by `GET /streams` according to the backend OpenAPI specification:
 * https://github.com/TricklePay/tricklepay-backend/blob/main/openapi.yaml
 */
export const ALLOWED_STREAM_QUERY_PARAMS = [
  "sender",
  "recipient",
  "status",
  "limit",
  "offset",
  "cursor",
  "includeTotal",
] as const;

export type AllowedStreamQueryParam = (typeof ALLOWED_STREAM_QUERY_PARAMS)[number];

export interface StreamStore {
  /** Streams the API currently reports. Mutate between navigations. */
  streams: StreamView[];
  /** Optional per-stream event histories returned by GET /streams/:id/events. */
  events?: Record<string, StreamEvent[]>;
}

export async function stubApi(page: Page, store: StreamStore): Promise<void> {
  // The indexer-lag banner's read (GET /status): caught up, so no banner.
  await page.route(`${API_URL}/status`, (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ lagLedgers: 0 }),
    }),
  );

  // The header's reachability probe (GET /health).
  await page.route(`${API_URL}/health`, (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ status: "ok", version: "test" }),
    }),
  );

  await page.route(`${API_URL}/streams**`, async (route: Route) => {
    const url = new URL(route.request().url());

    const eventsMatch = url.pathname.match(/^\/streams\/([^/]+)\/events$/);
    if (eventsMatch) {
      const stream = store.streams.find((s) => s.id === eventsMatch[1]);
      if (!stream) {
        return route.fulfill({ status: 404, headers: corsHeaders(), body: "{}" });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders() },
        body: JSON.stringify(store.events?.[eventsMatch[1]] ?? []),
      });
    }

    const byId = url.pathname.match(/^\/streams\/(.+)$/);
    if (byId) {
      const stream = store.streams.find((s) => s.id === byId[1]);
      if (!stream) {
        return route.fulfill({ status: 404, headers: corsHeaders(), body: "{}" });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders() },
        body: JSON.stringify(stream),
      });
    }

    // Reject parameters the backend OpenAPI document does not accept with 400.
    for (const key of url.searchParams.keys()) {
      if (!ALLOWED_STREAM_QUERY_PARAMS.includes(key as AllowedStreamQueryParam)) {
        return route.fulfill({
          status: 400,
          headers: { "content-type": "application/json", ...corsHeaders() },
          body: JSON.stringify({ error: `Unknown query parameter: ${key}` }),
        });
      }
    }

    const sender = url.searchParams.get("sender");
    const recipient = url.searchParams.get("recipient");
    const status = url.searchParams.get("status");
    const streams = store.streams.filter((s) => {
      if (sender && s.sender !== sender) return false;
      if (recipient && s.recipient !== recipient) return false;
      if (status && s.status !== status) return false;
      return true;
    });
    const total = streams.length;
    const limit = Number(url.searchParams.get("limit") ?? total);
    const cursor = url.searchParams.get("cursor");
    const cursorIndex = cursor ? streams.findIndex((s) => s.id === cursor) : -1;
    const offset = cursorIndex >= 0 ? cursorIndex + 1 : Number(url.searchParams.get("offset") ?? 0);
    const includeTotal = url.searchParams.get("includeTotal") === "true";
    const pageStreams = streams.slice(offset, offset + limit);
    const hasNext = offset + limit < total && pageStreams.length > 0;

    const body: Record<string, unknown> = {
      streams: pageStreams,
      limit,
      offset: cursor ? 0 : offset,
    };
    if (includeTotal) {
      body.total = total;
    }
    if (hasNext) {
      body.nextCursor = pageStreams[pageStreams.length - 1].id;
    }

    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders() },
      body: JSON.stringify(body),
    });
  });
}

// A streaming stream, half elapsed, with nothing withdrawn yet.
export function streamingStream(overrides: Partial<StreamView> = {}): StreamView {
  const now = Math.floor(Date.now() / 1000);
  const total = 1_000_000_000n;
  const vested = total / 2n;
  return {
    id: "1",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: TOKEN_ID,
    totalAmount: total.toString(),
    withdrawn: "0",
    vested: vested.toString(),
    withdrawable: vested.toString(),
    locked: (total - vested).toString(),
    startTime: String(now - 50),
    endTime: String(now + 50),
    cliffTime: String(now - 50),
    cancelled: false,
    status: "streaming",
    // Half elapsed with a linear schedule: 5000 of 10000 basis points.
    progress: 5_000,
    ...overrides,
  };
}

// A cancelled stream as the backend reports it after the cancel settles: half
// had vested, 2 of that was already withdrawn, so 3 stays claimable and the
// unvested 5 went back to the sender. Amounts are in 7-decimal base units.
export function cancelledStream(overrides: Partial<StreamView> = {}): StreamView {
  return streamingStream({
    cancelled: true,
    status: "cancelled",
    withdrawn: "200000000",
    vested: "500000000",
    withdrawable: "300000000",
    locked: "500000000",
    progress: 10_000,
    ...overrides,
  });
}
