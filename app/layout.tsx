import type { Metadata } from "next";
import { Header } from "@/components/header";
import { SkipLink } from "@/components/skip-link";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tricklepay.xyz";

// Applies the persisted (or OS-preferred) theme to <html> synchronously,
// before hydration, so there is no flash of the wrong theme. Mirrors the
// logic in lib/theme.ts's resolveInitialTheme, which is unit tested; this
// copy has to stay inline JS since it must run before any bundle loads.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var light=s==="light"||s==="dark"?s==="light":window.matchMedia("(prefers-color-scheme: light)").matches;if(light)document.documentElement.classList.add("light");}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "TricklePay",
    // Page-level titles render as "Page — TricklePay"
    template: "%s — TricklePay",
  },
  description:
    "TricklePay lets you stream token payments on Stellar in real time — create, manage, and withdraw from vesting streams without leaving your browser.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TricklePay",
    title: "TricklePay — Token streaming on Stellar",
    description:
      "Create and manage real-time token payment streams on the Stellar network. Cliff vesting, live accrual, and instant withdrawal — all non-custodial.",
    // app/opengraph-image.svg is picked up automatically by Next.js; this
    // explicit entry ensures the correct dimensions are advertised.
    images: [
      {
        url: "/opengraph-image.svg",
        width: 1200,
        height: 630,
        alt: "TricklePay — Token streaming on Stellar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TricklePay — Token streaming on Stellar",
    description:
      "Create and manage real-time token payment streams on the Stellar network. Cliff vesting, live accrual, and instant withdrawal — all non-custodial.",
    images: ["/opengraph-image.svg"],
  },
  icons: {
    // app/icon.svg and app/apple-icon.svg are resolved automatically by
    // Next.js's file-based metadata conventions. These entries are explicit
    // fallbacks that ensure the correct rel and sizes are also emitted.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <ThemeProvider>
          <WalletProvider>
            <SkipLink />
            <Header />
            {children}
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
