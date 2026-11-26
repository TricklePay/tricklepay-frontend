// Mirrors the tricklepay-backend API response. Amounts are held as strings
// because Soroban uses 128-bit integers for balances, which exceed JavaScript's
// MAX_SAFE_INTEGER. Parsing an amount as a Number or using parseFloat() risks
// silent loss of precision (e.g. truncating the lowest digits).
//
// Amounts are base units of the stream's token. To convert an amount for display,
// do not cast it to a Number or assume 7 decimals. Instead, use `formatTokenAmount`
// from `lib/format.ts` or resolve token decimals via `getCachedTokenDecimals` /
// `readTokenDecimals` from `lib/token-decimals.ts` alongside `formatAmount`.
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
  
  /** Total stream amount in base units of the stream's token, as a string. Format using `formatTokenAmount` or token decimals helpers. */
  totalAmount: string;
  
  /** Amount already withdrawn in base units of the stream's token, as a string. Format using `formatTokenAmount` or token decimals helpers. */
  withdrawn: string;
  
  /** Amount vested so far in base units of the stream's token, as a string. Format using `formatTokenAmount` or token decimals helpers. */
  vested: string;
  
  /** Amount available to withdraw now in base units of the stream's token, as a string. Format using `formatTokenAmount` or token decimals helpers. */
  withdrawable: string;
  
  /** Amount still locked (not yet vested) in base units of the stream's token, as a string. Format using `formatTokenAmount` or token decimals helpers. */
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
  total?: number;
  nextCursor?: string;
  limit?: number;
  offset?: number;
}

export type StreamEventKind = "created" | "withdrawn" | "cancelled";

export interface StreamEvent {
  /** RPC event id in TOID-index form, used as the ordering key */
  eventId: string;
  /** Event kind emitted by the stream contract */
  kind: StreamEventKind;
  /** Stream id associated with the event (uint64, decimal string) */
  streamId: string;
  /** Ledger sequence containing the event */
  ledger: number;
  /** Transaction hash that emitted the event */
  txHash: string;
  /** Sender address for created/cancelled events, if present */
  sender?: string | null;
  /** Recipient address for created/withdrawn/cancelled events, if present */
  recipient?: string | null;
  /** Token contract address for created events, if present */
  token?: string | null;
  /** Total amount for created events, in base units as a decimal string */
  totalAmount?: string | null;
  /** Withdrawn amount for withdrawal events, in base units as a decimal string */
  amount?: string | null;
  /** Recipient payout for cancellation events, in base units as a decimal string */
  recipientAmount?: string | null;
  /** Sender refund for cancellation events, in base units as a decimal string */
  senderRefund?: string | null;
  /** Stream start time in Unix seconds for created events, as a decimal string */
  startTime?: string | null;
  /** Stream end time in Unix seconds for created events, as a decimal string */
  endTime?: string | null;
  /** Vesting cliff time in Unix seconds for created events, as a decimal string */
  cliffTime?: string | null;
  /** Ledger close time in Unix seconds for the event, as a decimal string */
  closedAt?: string | null;
}

/** Totals for one side (incoming or outgoing) of an account, from GET /accounts/:address/summary. */
export interface AccountSideSummary {
  /** Number of streams on this side, across every page */
  count: number;
  /** Amount totals in base units as decimal strings. The backend sums them across tokens. */
  totalAmount: string;
  withdrawn: string;
  vested: string;
  withdrawable: string;
}

export interface AccountSummary {
  incoming: AccountSideSummary;
  outgoing: AccountSideSummary;
}
