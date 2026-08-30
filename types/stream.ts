// Mirrors the tricklepay-backend API response. Amounts are held as strings
// because Soroban uses 128-bit integers for balances, which exceed JavaScript's
// MAX_SAFE_INTEGER. Parsing an amount as a Number or using parseFloat() risks
// silent loss of precision (e.g. truncating the lowest digits).
//
// To convert an amount for display, do not cast it to a Number. Instead, use
// `formatAmount(string)` from `lib/format.ts`, which safely computes the
// fractional representation using BigInt math.
//
// Times are Unix-second strings for the same precision reason.

export type StreamStatus = "pending" | "streaming" | "completed" | "cancelled";

export interface StreamView {
  /** Unique stream identifier */
  id: string;
  
  /** Stellar address (G...) of the stream sender */
  sender: string;
  
  /** Stellar address (G...) of the stream recipient */
  recipient: string;
  
  /** Stellar contract address of the token being streamed */
  token: string;
  
  /** Total stream amount in base units (stroops, 7 decimals), as a string */
  totalAmount: string;
  
  /** Amount already withdrawn in base units (stroops), as a string */
  withdrawn: string;
  
  /** Amount vested so far in base units (stroops), as a string */
  vested: string;
  
  /** Amount available to withdraw now in base units (stroops), as a string */
  withdrawable: string;
  
  /** Amount still locked (not yet vested) in base units (stroops), as a string */
  locked: string;
  
  /** Stream start time, Unix seconds as a string */
  startTime: string;
  
  /** Stream end time, Unix seconds as a string */
  endTime: string;
  
  /** Cliff time (earliest withdrawal time), Unix seconds as a string */
  cliffTime: string;
  
  /** Whether the stream has been cancelled */
  cancelled: boolean;
  
  /** Current stream status */
  status: StreamStatus;
  
  /**
   * Vesting progress in basis points (0 to 10000).
   * 10000 basis points = 100% completion.
   */
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
