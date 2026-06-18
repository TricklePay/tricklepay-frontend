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
  startTime: string;
  endTime: string;
  cliffTime: string;
  cancelled: boolean;
  status: StreamStatus;
}

export interface StreamListResponse {
  streams: StreamView[];
}
