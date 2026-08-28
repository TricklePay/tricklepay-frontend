import { config } from "@/lib/config";
import {
  ApiResponseError,
  parseStreamListResponse,
  parseStreamView,
} from "@/lib/api-schema";
import type { StreamListResponse, StreamStatus, StreamView } from "@/types/stream";

export { ApiResponseError } from "@/lib/api-schema";

export interface ListStreamsParams {
  sender?: string;
  recipient?: string;
  limit?: number;
  offset?: number;
  status?: StreamStatus | "all";
}

// Reads the response body as JSON. A body that is not JSON at all (an HTML
// error page from a proxy, an empty 200) is reported the same way a
// structurally wrong payload is, so callers only have one failure mode to
// handle for "the backend did not answer with what it promised".
async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new ApiResponseError(`Malformed API response: ${what} was not valid JSON.`);
  }
}

// Fetches a page of streams from the backend, optionally filtered by party and status. The
// whole envelope is returned rather than just the rows so callers can page
// through a result set larger than the backend's default limit. Results are not
// cached so the list reflects the latest indexed state. The payload is checked
// against the documented shape before it is handed back (see lib/api-schema.ts).
export async function listStreams(
  params: ListStreamsParams = {},
): Promise<StreamListResponse> {
  const url = new URL("/streams", config.apiUrl);
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.recipient) url.searchParams.set("recipient", params.recipient);
  if (params.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load streams (${res.status})`);
  }

  return parseStreamListResponse(await readJson(res, "the stream list"));
}

// Fetches a single stream by id, or null if it does not exist.
export async function getStream(id: string): Promise<StreamView | null> {
  const url = new URL(`/streams/${id}`, config.apiUrl);

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load stream ${id} (${res.status})`);
  }

  return parseStreamView(await readJson(res, `stream ${id}`));
}
