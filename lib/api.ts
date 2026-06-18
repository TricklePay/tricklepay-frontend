import { config } from "@/lib/config";
import type { StreamListResponse, StreamView } from "@/types/stream";

export interface ListStreamsParams {
  sender?: string;
  recipient?: string;
  limit?: number;
  offset?: number;
}

// Fetches streams from the backend, optionally filtered by party. Results are
// not cached so the list reflects the latest indexed state.
export async function listStreams(params: ListStreamsParams = {}): Promise<StreamView[]> {
  const url = new URL("/streams", config.apiUrl);
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.recipient) url.searchParams.set("recipient", params.recipient);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load streams (${res.status})`);
  }

  const data = (await res.json()) as StreamListResponse;
  return data.streams;
}

// Fetches a single stream by id, or null if it does not exist.
export async function getStream(id: string): Promise<StreamView | null> {
  const url = new URL(`/streams/${id}`, config.apiUrl);

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load stream ${id} (${res.status})`);
  }

  return (await res.json()) as StreamView;
}
