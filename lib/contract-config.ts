// Tuning surface for the Soroban invocation flow (see lib/contract.ts).
// All timing and fee values used while building, submitting, and confirming
// transactions live here so they can be reviewed and tuned in one place.
// Behaviour is unchanged — these are the same values previously inlined in
// the invocation flow.

// Minimum fee applied when building every transaction: the network minimum of
// 100 stroops, the same value as the SDK's BASE_FEE. Written out rather than
// imported so this module does not pull the SDK into every bundle that reads
// a timing constant. Simulation (prepareTransaction) raises the fee to cover
// the actual Soroban resource footprint, so this only needs to satisfy the
// structural minimum at build time.
export const TRANSACTION_BASE_FEE = "100";

// Seconds a built transaction stays valid. Covers simulation, the wallet's
// signing prompt and submission; after that the network rejects it outright.
export const TX_TIMEOUT_SECONDS = 60;

// Confirmation polls getTransaction on this interval. One second balances
// responsiveness (the UI advances promptly) against RPC load (no tight loop).
export const CONFIRM_POLL_INTERVAL_MS = 1_000;

// Maximum confirmation polls before giving up with a TransactionTimeoutError
// the user can recover from. 30 attempts × 1 s interval = ~30 s budget,
// matching the Soroban RPC's typical ledger-close cadence while keeping the
// UI from waiting indefinitely on a stuck transaction.
export const CONFIRM_POLL_ATTEMPTS = 30;

// Maximum sendTransaction attempts when the RPC responds with TRY_AGAIN_LATER.
// 3 attempts with exponential backoff (500 ms, 1000 ms) gives a transient RPC
// spike ~1.5 s to clear without eating into TX_TIMEOUT_SECONDS.
export const SUBMIT_MAX_ATTEMPTS = 3;

// Base delay in milliseconds before retrying a TRY_AGAIN_LATER response;
// doubled after each failed attempt.
export const SUBMIT_RETRY_BASE_DELAY_MS = 500;
