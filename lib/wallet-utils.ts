/**
 * Maps Freighter's network label ("TESTNET", "PUBLIC") to the app's lowercase
 * names ("testnet", "mainnet") so it can be compared against the configured network.
 */
export function normalizeNetwork(network: string): string {
  const lower = network.toLowerCase();
  if (lower.includes("test")) return "testnet";
  if (lower.includes("public")) return "mainnet";
  return lower;
}
