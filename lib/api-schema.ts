// Runtime validation for tricklepay-backend responses.
//
// `lib/api.ts` used to cast the parsed JSON straight to `StreamView` /
// `StreamListResponse`, so a backend that drifted from the contract in
// `docs/api-contract.md` surfaced far from the cause: a number where a
// base-unit string was expected blows up inside `BigInt(...)` in
// `lib/format.ts`, and a missing field renders as `undefined` in the table.
// Validating at the boundary turns both into one actionable error naming the
// offending field.
//
// Validation asserts, it does not normalise: the payload is returned exactly
// as it arrived so nothing downstream has to care that it passed through here.

import type { StreamListResponse, StreamStatus, StreamView } from "@/types/stream";


const STREAM_STATUSES: readonly StreamStatus[] = [
  "pending",
  "streaming",
  "completed",
  "cancelled",
];

/**
 * Thrown when a backend response does not match the documented shape. Kept as
 * its own class so callers can tell "the backend answered with nonsense" apart
 * from "the backend answered with an error status".
 */
export class ApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiResponseError";
  }
}

function fail(path: string, expectation: string, value: unknown): never {
  throw new ApiResponseError(
    `Malformed API response: ${path} ${expectation} (received ${describe(value)}).`,
  );
}

// A short, safe rendering of an unexpected value for the error message. Long
// strings are truncated so a whole HTML error page cannot end up in the UI.
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") {
    const shown = value.length > 40 ? `${value.slice(0, 40)}…` : value;
    return `the string "${shown}"`;
  }
  if (typeof value === "object") return "an object";
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") fail(`${path}.${key}`, "must be a string", value);
  return value;
}

// Amounts and Unix-second timestamps are decimal integer strings so they
// survive `BigInt(...)` without loss (see "Amount encoding" in
// docs/api-contract.md). Anything else — a JSON number, a float, an empty
// string — would throw deep inside a formatter instead of here.
function requireIntegerString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = requireString(source, key, path);
  if (!/^-?\d+$/.test(value)) {
    fail(`${path}.${key}`, "must be a decimal integer string", value);
  }
  return value;
}

/**
 * Validates one stream object against the `StreamView` contract.
 *
 * `path` names the value's position in the enclosing payload (e.g.
 * `streams[3]`) so an error points at the offending row rather than at the
 * request as a whole.
 */
export function parseStreamView(value: unknown, path = "response"): StreamView {
  if (!isRecord(value)) fail(path, "must be an object", value);

  requireString(value, "id", path);
  requireString(value, "sender", path);
  requireString(value, "recipient", path);
  requireString(value, "token", path);

  for (const key of ["totalAmount", "withdrawn", "vested", "withdrawable", "locked"]) {
    requireIntegerString(value, key, path);
  }
  for (const key of ["startTime", "endTime", "cliffTime"]) {
    requireIntegerString(value, key, path);
  }

  const status = value.status;
  if (typeof status !== "string" || !STREAM_STATUSES.includes(status as StreamStatus)) {
    fail(`${path}.status`, `must be one of ${STREAM_STATUSES.join(", ")}`, status);
  }

  // `cancelled` is checked only when present: `status === "cancelled"` already
  // carries the same information, and older backend builds omit the flag.
  if (value.cancelled !== undefined && typeof value.cancelled !== "boolean") {
    fail(`${path}.cancelled`, "must be a boolean", value.cancelled);
  }

  const progress = value.progress;
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    fail(`${path}.progress`, "must be a finite number", progress);
  }

  return value as unknown as StreamView;
}

function requireCount(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(`response.${key}`, "must be a non-negative integer", value);
  }
  return value;
}

/**
 * Validates a `GET /streams` envelope and every row inside it.
 */
export function parseStreamListResponse(value: unknown): StreamListResponse {
  if (!isRecord(value)) fail("response", "must be an object", value);

  const streams = value.streams;
  if (!Array.isArray(streams)) fail("response.streams", "must be an array", streams);

  streams.forEach((stream, index) => parseStreamView(stream, `response.streams[${index}]`));

  requireCount(value, "total");
  // `limit`/`offset` are echoed back by the backend but the frontend paginates
  // from its own counters, so they are only checked when present rather than
  // failing a page whose rows are perfectly usable.
  if (value.limit !== undefined) requireCount(value, "limit");
  if (value.offset !== undefined) requireCount(value, "offset");

  return value as unknown as StreamListResponse;
}
