// Links a transaction hash to its page on Stellar Expert. Takes the network
// name directly (rather than importing lib/config) so it stays a pure,
// easily testable function — the caller already has `config.network` in
// scope.

const EXPLORER_NETWORK_SEGMENT: Record<string, string> = {
  testnet: "testnet",
  mainnet: "public",
};

export function txExplorerUrl(hash: string, network: string): string {
  const segment = EXPLORER_NETWORK_SEGMENT[network] ?? "testnet";
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}
