import type { NextConfig } from "next";

// Pulls the origin out of a configured URL so it can be added to the CSP's
// connect-src. Falls back to undefined for an unset or malformed value
// rather than throwing — next.config.ts runs at build/start time and a bad
// env var here shouldn't take the whole app down.
function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const isProd = process.env.NODE_ENV === "production";

// The backend API and Soroban RPC endpoints the app actually calls (see
// lib/config.ts). These are read from the same NEXT_PUBLIC_* vars so a
// deployment pointing at a different API/RPC host doesn't need the CSP
// hand-edited too — it stays in sync with the app's own runtime config.
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
const rpcOrigin = originOf(process.env.NEXT_PUBLIC_RPC_URL);

const connectSrc = Array.from(
  new Set(
    [
      "'self'",
      // Public Soroban RPC defaults (lib/config.ts's DEFAULT_RPC_URLS) —
      // listed explicitly so the app works out of the box even when
      // NEXT_PUBLIC_RPC_URL isn't set.
      "https://soroban-testnet.stellar.org",
      "https://mainnet.sorobanrpc.com",
      apiOrigin,
      rpcOrigin,
    ].filter((value): value is string => Boolean(value)),
  ),
);

// script-src needs 'unsafe-inline' for the theme-bootstrap script in
// app/layout.tsx (it has to run before any bundle loads, so it can't be an
// external file) and for Next.js's own hydration data script. Dev-only
// 'unsafe-eval' is for webpack's Fast Refresh, which eval()s updated modules;
// production builds don't need it.
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"])].join(" ");

// style-src needs 'unsafe-inline': components/progress-bar.tsx sets its fill
// width via a dynamic inline `style` attribute, which CSP's style-src governs
// the same as a <style> tag.
const CSP = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Applies to every route — the wallet-signing flows this protects
        // aren't confined to one page.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Belt-and-braces alongside frame-ancestors 'none' above: older
          // browsers that don't honour CSP frame-ancestors still respect
          // X-Frame-Options, which is what actually stops a stream-cancel or
          // withdraw button from being clickjacked inside a hidden iframe.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
