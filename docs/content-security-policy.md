# Content-Security-Policy

`next.config.ts` sets a `Content-Security-Policy` header on every route, next to
`X-Frame-Options`, `Referrer-Policy` and `X-Content-Type-Options`. The wallet
signing flows it protects are not confined to one page, so the policy applies
to `/(.*)`.

## Directives

| Directive | Value | Why |
| --- | --- | --- |
| `default-src` | `'self'` | Anything not listed below can only load from the app's own origin. |
| `script-src` | `'self' 'unsafe-inline'` (plus `'unsafe-eval'` in development) | The theme bootstrap script in `app/layout.tsx` must run before any bundle loads, and Next.js emits an inline hydration data script. Development adds `'unsafe-eval'` because Fast Refresh evaluates updated modules; production builds do not need it. |
| `style-src` | `'self' 'unsafe-inline'` | `components/progress-bar.tsx` sets its fill width through an inline `style` attribute, which `style-src` governs like a `<style>` tag. |
| `img-src` | `'self' data:` | Local images and inline data URIs. |
| `font-src` | `'self' data:` | Local fonts and inline data URIs. |
| `connect-src` | `'self'` plus the API and RPC origins | The app fetches the backend API and the Soroban RPC. See below. |
| `frame-src` | `'none'` | The app embeds no frames. |
| `frame-ancestors` | `'none'` | Stops the app being framed, so a cancel or withdraw button cannot be clickjacked. `X-Frame-Options: DENY` backs this up for older browsers. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | Blocks an injected `<base>` tag from redirecting relative URLs. |
| `form-action` | `'self'` | Forms can only submit to the app itself. |

## How the connect sources follow the environment

`connect-src` is built from the same variables the app reads at runtime, so a
deployment does not need the policy edited by hand:

- `NEXT_PUBLIC_API_URL`: its origin is added.
- `NEXT_PUBLIC_RPC_URL`: its origin is added.
- The public Soroban RPC defaults (`https://soroban-testnet.stellar.org` and
  `https://mainnet.sorobanrpc.com`) are always listed, so the app works when
  `NEXT_PUBLIC_RPC_URL` is unset.

An unset or malformed URL is skipped instead of throwing, because
`next.config.ts` runs at build and start time. Duplicates are removed.

The header is computed when the server starts or builds, so change the
environment variable and restart or rebuild to pick up a new origin.

## How to change it

1. To allow a new API or RPC host, set `NEXT_PUBLIC_API_URL` or
   `NEXT_PUBLIC_RPC_URL`. No code change is needed.
2. To allow another origin, for example a new service the app calls, add it to
   the `connectSrc` array in `next.config.ts`.
3. To change any other directive, edit the `CSP` array in `next.config.ts` and
   explain the reason in a comment next to it.
4. Run the app and check the browser console for `Refused to ...` messages. A
   blocked request names the directive that blocked it.

If the app is embedded in another site, `frame-ancestors 'none'` and
`X-Frame-Options: DENY` must be relaxed together, otherwise browsers will
still refuse to frame it.

## Known compromises

- **`script-src 'unsafe-inline'`.** Needed for the theme bootstrap script and
  Next.js hydration data. It weakens protection against injected inline
  scripts. Path to remove it: generate a per-request nonce in middleware, pass
  it to the inline scripts, and replace `'unsafe-inline'` with
  `'nonce-<value>'` (with `'strict-dynamic'` if needed). This makes every page
  dynamically rendered.
- **`style-src 'unsafe-inline'`.** Needed for the progress bar's dynamic width.
  Path to remove it: drive the width with a CSS custom property set through a
  class or the CSSOM instead of an inline `style` attribute, or use a nonce.
- **Development `'unsafe-eval'`.** Only present outside production builds.
