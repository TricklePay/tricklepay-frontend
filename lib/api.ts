// The API client is the sole channel for browser-to-backend communication.
// All requests are routed to the base URL provided by `config.apiUrl`.
// Connection issues, timeouts, and malformed responses are surfaced as
// rejected Promises, expecting callers to handle and display those errors.
import {
  ApiResponseError,
  parseStreamListResponse,
  parseStreamView,
} from "@/lib/api-schema";
import { config } from "@/lib/config";

import type { StreamListResponse, StreamStatus, StreamView } from "@/types/stream";


export { ApiResponseError } from "@/lib/api-schema";

export interface ListStreamsParams {
  sender?: string;
  recipient?: string;
  limit?: number;
  offset?: number;
  status?: StreamStatus | "all";
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
 * themselves. Identified by `name` rather than by `instanceof DOMException`
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
  const timeoutMs = options.timeoutMs ?? config.apiTimeoutMs;
  const controller = new AbortController();
  const callerSignal = options.signal;
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
export async function listStreams(
  params: ListStreamsParams = {},
  options: RequestOptions = {},
): Promise<StreamListResponse> {
  const url = new URL("/streams", config.apiUrl);
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.recipient) url.searchParams.set("recipient", params.recipient);
  if (params.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));

  return request(url, "the stream list", options, async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to load streams (${res.status})`);
    }
    return parseStreamListResponse(await readJson(res, "the stream list"));
  });
}

// Fetches a single stream by id, or null if it does not exist.
export async function getStream(
  id: string,
  options: RequestOptions = {},
): Promise<StreamView | null> {
  const url = new URL(`/streams/${id}`, config.apiUrl);

  return request(url, `stream ${id}`, options, async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to load stream ${id} (${res.status})`);
    }
    return parseStreamView(await readJson(res, `stream ${id}`));
  });
}
