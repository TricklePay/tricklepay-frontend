// Mirrors the tricklepay-backend API response. Amounts are strings to preserve
// 128-bit precision; times are Unix-second strings for the same reason.

export type StreamStatus = "pending" | "streaming" | "completed" | "cancelled";

export interface StreamView {
  id: string;
  sender: string;
  recipient: string;
  token: string;
  totalAmount: string;
  withdrawn: string;
  vested: string;
  withdrawable: string;
  locked: string;
  startTime: string;
  endTime: string;
  cliffTime: string;
  cancelled: boolean;
  status: StreamStatus;
  // Basis points (0 to 10000) of the total amount that has vested.
  progress: number;
}

// A page of streams. `total` is the number of streams matching the query across
// every page, not the length of `streams`, so the UI can report how many rows
// remain unfetched.
export interface StreamListResponse {
  streams: StreamView[];
  total: number;
  limit: number;
  offset: number;
}
