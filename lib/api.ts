// The API client is the sole channel for browser-to-backend communication.
// All requests are routed to the base URL provided by `config.apiUrl`.
// Connection issues, timeouts, and malformed responses are surfaced as
// rejected Promises, expecting callers to handle and display those errors.
//
// # Balance accuracy vs. load: why balances are interpolated locally
//
// Stream balances are not polled from the backend on a timer. Instead, the
// client fetches authoritative stream data once and then advances the displayed
// balance locally between fetches. This is a deliberate trade-off between
// accuracy and load:
//
// - Accuracy: a polling loop would need to run on the order of once per
//   second to keep the displayed balance visually current, because streams
//   accrue continuously. That is one request per stream per second for every
//   open tab, which multiplies into a load spike that grows with the number of
//   viewers and the number of streams they are watching.
// - Load: between fetches the client interpolates the balance from the last
//   authoritative snapshot using the stream's rate and the elapsed time,
//   so the number keeps moving without any additional requests.
//
// Authoritative data is fetched on demand, not on a polling interval:
// - when a stream is first opened or its view is mounted,
// - when the user explicitly refreshes, and
// - when a mutation (create/update/cancel) succeeds and the cache is
//   invalidated.
// The interval between those fetches is therefore driven by user action and
// by the cache strategy, not by a fixed timer.
//
// The ledger clock is the source of truth. Interpolation is an estimate for
// display only; the authoritative balance is what the ledger reports at a
// given ledger time. When the client and the ledger disagree -- a stream was
// cancelled, a transfer settled, the clock drifted -- the next fetch wins and
// the interpolated value is discarded. Nothing in this module treats a locally
// advanced balance as authoritative.
import {
  ApiResponseError,
  parseStreamEvents,
  parseStreamListResponse,
  parseStreamView,
} from "@/lib/api-schema";
import { config } from "@/lib/config";
import { mockGetStream, mockGetStreamEvents, mockListStreams } from "@/lib/mock-api";
import type {
  StreamEvent,
  StreamListResponse,
  StreamStatus,
  StreamView,
} from "@/types/stream";

export { ApiResponseError } from "@/lib/api-schema";

export interface ListStreamsParams {
  sender?: string;
  recipient?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  status?: StreamStatus | "all";
  includeTotal?: boolean;
}

/** Shared contract for stream reads. Both the real backend client below and
 * the mock client in `lib/mock-api.ts` satisfy this type, so a signature or
 * shape change to one becomes a typecheck failure on the other. */
export interface StreamApiClient {
  listStreams(
    params?: ListStreamsParams,
    options?: RequestOptions,
  ): Promise<StreamListResponse>;
  getStream(id: string, options?: RequestOptions): Promise<StreamView | null>;
  getStreamEvents(id: string, options?: RequestOptions): Promise<StreamEvent[]>;
}
/** Per-request options shared by every call in this module. */
export interface RequestOptions {
  /**
   * Aborts the request when signalled. Callers pass the signal of a controller
   * they abort when the result stops being wanted — the query changed, the
   * component unmounted — so the browser drops the connection instead of
   * decoding a response nobody will read.
   */
  signal?: AbortSignal;
  /**
   * Overrides `config.apiTimeoutMs` for this one call. 0 disables the timeout.
   * Callers rarely need this; it exists for the odd request that is expected to
   * be slower (or faster to give up on) than the app-wide default.
   */
  timeoutMs?: number;
}

/**
 * True for the error a `fetch` rejects with once its signal is aborted.
 *
 * An abort is a normal outcome, not a failure: callers use this to swallow it
 * rather than flashing "Failed to load streams" for a request they cancelled
 * themselves. Identified by `name` rather than by instanceof DOMException`
 * because Node's undici and jsdom each reject with their own error class.
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Thrown when a request outlives its timeout budget.
 *
 * Deliberately *not* an abort: a timeout is a failure the user should see
 * ("the backend is not answering"), whereas a caller-driven abort is one they
 * should never see. `isAbortError` returns false for it, so the callers that
 * swallow cancellations still surface this.
 */
export class ApiTimeoutError extends Error {
  constructor(
    readonly timeoutMs: number,
    what: string,
  ) {
    super(
      `Timed out loading ${what} after ${Math.round(timeoutMs / 100) / 10}s. ` +
      "The backend may be unreachable or overloaded — check it is running, then try again.",
    );
    this.name = "ApiTimeoutError";
  }
}

/** True for the error thrown when a request exceeds its timeout. */
export function isTimeoutError(error: unknown): error is ApiTimeoutError {
  return error instanceof ApiTimeoutError;
}

/**
 * Thrown when the backend responds with a non-OK status.
 * Preserves the backend's error code, error message, and requestId when present.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly backendError?: string;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      error?: string;
      requestId?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.backendError = options.error;
    this.requestId = options.requestId;
  }

  get error(): string | undefined {
    return this.backendError;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

async function createApiError(res: Response, fallbackPrefix: string): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : undefined;

  const code = typeof payload?.code === "string" ? payload.code : undefined;
  const backendError = typeof payload?.error === "string" ? payload.error : undefined;
  const requestId = typeof payload?.requestId === "string" ? payload.requestId : undefined;

  const message = backendError || `${fallbackPrefix} (${res.status})`;

  return new ApiError(message, {
    status: res.status,
    code,
    error: backendError,
    requestId,
  });
}

// Reads the response body as JSON. A body that is not JSON at all (an HTML
// error page from a proxy, an empty 200) is reported the same way a
// structurally wrong payload is, so callers only have one failure mode to
// handle for "the backend did not answer with what it promised".
async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch (error) {
    // Aborting mid-body rejects the `json()` read too; that is a cancellation,
    // not a malformed payload, so let it through unchanged.
    if (isAbortError(error)) throw error;
    throw new ApiResponseError(`Malformed API response: ${what} was not valid JSON.`);
  }
}

// Runs one backend read under both the caller's cancellation signal and the
// configured timeout.
//
// The two are merged into a single internal controller rather than handed to
// fetch separately, because a request has one signal: aborting either source
// aborts the request. They are kept distinguishable afterwards — a timeout
// becomes an ApiTimeoutError the user sees, a caller abort stays an AbortError
// the caller swallows — which is why this does not simply use
// `AbortSignal.timeout()`, whose rejection is indistinguishable from any other
// abort at the catch site. The whole exchange is covered, body decoding
// included, so a backend that sends headers promptly and then stalls mid-body
// still times out.
async function request<T>(
  url: URL,
  what: string,
  options: RequestOptions,
  handle: (res: Response) => Promise<T>,
): Promise<T> {
  const callerSignal = options.signal;
  const timeoutMs = options.timeoutMs ?? config.apiTimeoutMs;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", forwardAbort);
  }

  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    return await handle(res);
  } catch (error) {
    // Only the timer's own abort becomes a timeout; a caller abort that landed
    // in the same tick is still the caller's cancellation.
    if (timedOut && isAbortError(error)) throw new ApiTimeoutError(timeoutMs, what);
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}

// Fetches a page of streams from the backend, optionally filtered by party and status. The
// whole envelope is returned rather than just the rows so callers can page
// through a result set larger than the backend's default limit. Results are not
// cached so the list reflects the latest indexed state. The payload is checked
// against the documented shape before it is handed back (see lib/api-schema.ts).
//
// This is the authoritative read that feeds the local balance interpolation
// described at the top of this module: the results are the ledger's view, and
// anything derived from them between calls is an estimate.
export async function listStreams(
  params: ListStreamsParams = {},
  options: RequestOptions = {},
): Promise<StreamListResponse> {
  if (config.mockApi) return mockListStreams(params);

  const url = new URL("/streams", config.apiUrl);
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.recipient) url.searchParams.set("recipient", params.recipient);
  if (params.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
  if (params.cursor !== undefined) url.searchParams.set("cursor", params.cursor);
  if (params.includeTotal !== undefined) {
    url.searchParams.set("includeTotal", String(params.includeTotal));
  }

  return request(url, "the stream list", options, async (res) => {
    if (!res.ok) {
      throw await createApiError(res, "Failed to load streams");
    }
    return parseStreamListResponse(await readJson(res, "the stream list"));
  });
}

// Fetches a single stream by id, or null if it does not exist.
//
// This is the authoritative snapshot used to seed and resync the locally
// interpolated balance. The ledger clock carried in the response is the
// source of truth; the client never invents a balance that disagrees with it
// once a fresh response arrives.
export async function getStream(
  id: string,
  options: RequestOptions = {},
): Promise<StreamView | null> {
  if (config.mockApi) return mockGetStream(id);

  const url = new URL(`/streams/${id}`, config.apiUrl);

  return request(url, `stream ${id}`, options, async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) {
      throw await createApiError(res, `Failed to load stream ${id}`);
    }
    return parseStreamView(await readJson(res, `stream ${id}`));
  });
}

// Fetches the indexed event history for a single stream in ascending chain
// order (GET /streams/:id/events).
export async function getStreamEvents(
  id: string,
  options: RequestOptions = {},
): Promise<StreamEvent[]> {
  if (config.mockApi) return mockGetStreamEvents(id);

  const url = new URL(`/streams/${id}/events`, config.apiUrl);

  return request(url, `events for stream ${id}`, options, async (res) => {
    if (res.status === 404) return [];
    if (!res.ok) {
      throw await createApiError(res, `Failed to load events for stream ${id}`);
    }
    return parseStreamEvents(await readJson(res, `events for stream ${id}`));
  });
}

// A health probe that has not answered in this long counts as unreachable.
// Shorter than the app-wide read timeout: /health does no database work, so a
// slow answer is itself the signal, and the probe should not linger.
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// Liveness probe for the backend (GET /health). Resolves true on a 2xx and false
// for anything else the backend or network can do wrong — a non-2xx status, a
// refused connection, a timeout — because the caller only wants "reachable or
// not". A caller-driven abort is the one exception and still rejects, so a
// cancelled probe is never mistaken for an outage.
export async function checkApiHealth(options: RequestOptions = {}): Promise<boolean> {
  const url = new URL("/health", config.apiUrl);
  try {
    return await request(
      url,
      "the API health check",
      { timeoutMs: HEALTH_CHECK_TIMEOUT_MS, ...options },
      async (res) => res.ok,
    );
  } catch (error) {
    if (isAbortError(error)) throw error;
    return false;
  }
}

// How many ledgers the backend's indexer is behind the chain (GET /status), or
// null when that is not known: the request failed, the body was not what the
// endpoint documents, or the indexer has not completed its first poll. The
// figure is advisory, so every failure collapses to "unknown" instead of an
// error; only a caller-driven abort still rejects.
export async function getIndexerLag(options: RequestOptions = {}): Promise<number | null> {
  const url = new URL("/status", config.apiUrl);
  try {
    return await request(url, "the indexer status", options, async (res) => {
      if (!res.ok) return null;
      const body = await readJson(res, "the indexer status");
      const lag = (body as { lagLedgers?: unknown } | null)?.lagLedgers;
      return typeof lag === "number" && Number.isInteger(lag) && lag >= 0 ? lag : null;
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

// Real backend client, typed against the shared contract so a signature drift
// against the mock in `lib/mock-api.ts` fails the typecheck.
export const apiClient: StreamApiClient = { listStreams, getStream, getStreamEvents };
