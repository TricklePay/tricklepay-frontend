import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "@/lib/csp";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const isProd = process.env.NODE_ENV === "production";

let themeScriptHash: Promise<string> | undefined;

// sha256 of the inline theme bootstrap, base64 as CSP expects.
function getThemeScriptHash(): Promise<string> {
  themeScriptHash ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(THEME_INIT_SCRIPT))
    .then((digest) => btoa(String.fromCharCode(...new Uint8Array(digest))));
  return themeScriptHash;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, await getThemeScriptHash(), isProd);

  // Next reads the nonce from the request's CSP header and applies it to the
  // scripts it renders.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
