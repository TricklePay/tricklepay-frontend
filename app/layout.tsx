import type { Metadata } from "next";
import type { JSX } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IndexerLagBanner } from "@/components/indexer-lag-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { SkipLink } from "@/components/skip-link";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

import "./globals.css";

// No hard-coded fallback domain: an unset NEXT_PUBLIC_APP_URL should not
// silently point canonical/social metadata at a URL we don't control.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Applies the persisted (or OS-preferred) theme to <html> synchronously,
// before hydration, so there is no flash of the wrong theme on first paint.
//
// WHY THIS EXISTS
// React renders <html> on the server without the "light" class (dark is the
// default). If we applied the theme in a useEffect, the page would flash from
// dark to light for users who prefer light mode. An inline <script> in <head>
// runs synchronously during HTML parsing, before the browser paints anything,
// so the correct class is already present when the first frame is drawn.
//
// LOGIC (mirrors resolveInitialTheme in lib/theme.ts — keep in sync)
//   1. Read localStorage["trickle-theme"].
//   2. If the stored value is "light" or "dark", use it (explicit user choice).
//   3. Otherwise fall back to window.matchMedia("(prefers-color-scheme: light)").
//   4. If the resolved theme is light, add class="light" to <html>. Do nothing
//      for dark — it is already the default via `color-scheme: dark` in CSS.
//
// suppressHydrationWarning on <html> silences React's hydration mismatch
// warning: the server renders without "light"; the bootstrap may add it on the
// client before React hydrates, which is intentional and expected.
//
// This script is intentionally kept as a minified inline string. It must be a
// single synchronously-executed script with no imports; any async work or
// bundle dependency would defeat its purpose.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var light=s==="light"||s==="dark"?s==="light":window.matchMedia("(prefers-color-scheme: light)").matches;if(light)document.documentElement.classList.add("light");}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "Your streams — TricklePay",
    // Page-level titles render as "Page — TricklePay"
    template: "%s — TricklePay",
  },
  description:
    "TricklePay lets you stream token payments on Stellar in real time — create, manage, and withdraw from vesting streams without leaving your browser.",
  metadataBase: APP_URL ? new URL(APP_URL) : null,
  // Tints the mobile browser address bar to match the app background.
  // dark:  neutral-950 (#0a0a0a) — the default page background.
  // light: neutral-950 in the light theme maps to #fafafa (see globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TricklePay",
    title: "TricklePay — Token streaming on Stellar",
    description:
      "Create and manage real-time token payment streams on the Stellar network. Cliff vesting, live accrual, and instant withdrawal — all non-custodial.",
    // app/opengraph-image.png is picked up automatically by Next.js's
    // file-based metadata convention. The explicit entry ensures the correct
    // dimensions and MIME type are advertised to social crawlers.
    // SVG is not reliably rendered by social platforms or iOS home screen —
    // the PNG replaces it as the canonical social image.
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "TricklePay — Token streaming on Stellar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TricklePay — Token streaming on Stellar",
    description:
      "Create and manage real-time token payment streams on the Stellar network. Cliff vesting, live accrual, and instant withdrawal — all non-custodial.",
    images: ["/opengraph-image.png"],
  },
  icons: {
    // app/icon.svg is kept for the browser tab favicon (SVG is supported by
    // all modern browsers for favicons). The Apple touch icon is switched to
    // PNG because iOS does not render SVG for home-screen icons.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {/* Shown only when JavaScript is disabled. The app requires JS for
            wallet signing — there is no useful fallback without it. The styles
            are inline so they work without any CSS bundle loading. */}
        <noscript>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              padding: "2rem",
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
              backgroundColor: "#0a0a0a",
              color: "#f5f5f5",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 16 16"
              fill="#6366f1"
              aria-hidden="true"
              style={{ marginBottom: "1rem" }}
            >
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM7.25 5a.75.75 0 0 1 1.5 0v3.25a.75.75 0 0 1-1.5 0V5Zm.75 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            </svg>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "#fafafa",
              }}
            >
              JavaScript is required
            </h1>
            <p
              style={{
                maxWidth: "28rem",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "#a3a3a3",
                marginBottom: "0.75rem",
              }}
            >
              TricklePay signs transactions through a browser wallet extension.
              Please enable JavaScript and install a compatible wallet to use this
              app.
            </p>
            <a
              href="https://freighter.app"
              style={{
                display: "inline-block",
                marginTop: "0.5rem",
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "1px solid #404040",
                color: "#d4d4d4",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Get Freighter wallet
            </a>
          </div>
        </noscript>
        <ThemeProvider>
          <WalletProvider>
            <SkipLink />
            <Header />
            <OfflineBanner />
            <IndexerLagBanner />
            {children}
            <Footer />
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
