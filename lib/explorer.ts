// Builds transaction links for Stellar Expert (https://stellar.expert), the
// block explorer used by this app.
//
// WHY A SEPARATE FILE
// The function takes `network` as an argument rather than importing lib/config
// directly. This keeps it a pure, side-effect-free helper that is easy to unit
// test and straightforward to swap out if the explorer changes.
// Callers pass `config.network` in scope; no circular dependency is introduced.
//
// URL PATTERN
// https://stellar.expert/explorer/{segment}/tx/{txHash}
//
// NETWORK → SEGMENT MAPPING
// Stellar Expert uses different path segments for each network, and its
// mainnet path is "public" (not "mainnet"):
//
//   config.network   Stellar Expert segment   Example URL
//   ─────────────── ────────────────────────  ──────────────────────────────────────
//   "testnet"        "testnet"                 …/explorer/testnet/tx/<hash>
//   "mainnet"        "public"                  …/explorer/public/tx/<hash>
//
// Any network string not in the table falls back to "testnet" so that
// development builds always produce a working link even when NEXT_PUBLIC_NETWORK
// is unset or set to an unrecognised value.
//
// ADDING A NEW NETWORK
// Add an entry to EXPLORER_NETWORK_SEGMENT keyed by the lowercase value you
// set in NEXT_PUBLIC_NETWORK:
//
//   "futurenet": "futurenet",
//
// If Stellar Expert does not support the network, point to a different base URL
// by extending txExplorerUrl to switch on the segment before constructing the
// final string.

const EXPLORER_NETWORK_SEGMENT: Record<string, string> = {
  testnet: "testnet",
  mainnet: "public", // Stellar Expert uses "public" for mainnet, not "mainnet"
};

/**
 * Returns the Stellar Expert URL for a submitted transaction.
 *
 * @param hash    - The transaction hash returned by the RPC after submission.
 * @param network - The active network name (`config.network`). Recognised
 *                  values are `"testnet"` and `"mainnet"`; unknown values fall
 *                  back to the testnet explorer.
 *
 * @example
 * txExplorerUrl("abc123", "testnet")
 * // → "https://stellar.expert/explorer/testnet/tx/abc123"
 *
 * @example
 * txExplorerUrl("abc123", "mainnet")
 * // → "https://stellar.expert/explorer/public/tx/abc123"
 */
export function txExplorerUrl(hash: string, network: string): string {
  const segment = EXPLORER_NETWORK_SEGMENT[network] ?? "testnet";
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}
