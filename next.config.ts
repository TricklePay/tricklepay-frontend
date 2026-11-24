import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

import { assertContractIdForBuild } from "./lib/build-guard";

// `npm run analyze` sets ANALYZE=true and writes bundle reports to
// .next/analyze/. With the flag unset the wrapper returns the config
// unchanged, so normal builds are unaffected.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Applies to every route — the wallet-signing flows this protects
        // aren't confined to one page.
        source: "/(.*)",
        headers: [
          // Content-Security-Policy is set per request in middleware.ts so
          // script-src can carry a nonce.
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

const makeConfig = (phase: string): NextConfig => {
  process.env.NEXT_PHASE = phase;
  // lib/config.ts cannot enforce this during the build (prerendering has to
  // succeed), so the build fails here instead.
  if (phase === "phase-production-build") {
    assertContractIdForBuild();
  }
  return withBundleAnalyzer(nextConfig);
};

export default makeConfig;
