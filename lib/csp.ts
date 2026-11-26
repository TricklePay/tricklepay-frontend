// Builds the Content-Security-Policy header. Used by middleware.ts so every
// response carries a fresh nonce instead of allowing 'unsafe-inline' scripts.

// Pulls the origin out of a configured URL. Falls back to undefined for an
// unset or malformed value rather than throwing.
function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
const rpcOrigin = originOf(process.env.NEXT_PUBLIC_RPC_URL);

const connectSrc = Array.from(
  new Set(
    [
      "'self'",
      // Public Soroban RPC defaults (DEFAULT_RPC_URLS in lib/config.ts), listed
      // so the app works out of the box when NEXT_PUBLIC_RPC_URL isn't set.
      "https://soroban-testnet.stellar.org",
      "https://mainnet.sorobanrpc.com",
      apiOrigin,
      rpcOrigin,
    ].filter((value): value is string => Boolean(value)),
  ),
);

/**
 * script-src in production is nonce + hash only. Next.js stamps the nonce on its
 * own hydration scripts, and the fixed theme bootstrap in app/layout.tsx is
 * allowed by its sha256 hash. Development keeps 'unsafe-eval' (webpack Fast
 * Refresh eval()s updated modules) and 'unsafe-inline' (the dev overlay injects
 * inline scripts); neither is sent in production.
 */
export function buildCsp(nonce: string, themeScriptHash: string, isProd: boolean): string {
  const scriptSrc = isProd
    ? ["'self'", `'nonce-${nonce}'`, `'sha256-${themeScriptHash}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  // style-src needs 'unsafe-inline': components/progress-bar.tsx sets its fill
  // width via a dynamic inline `style` attribute.
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");
}
