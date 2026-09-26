// Pure theme logic — no DOM or storage access, so this module is fully unit
// testable and safe to import on the server.
//
// ─── HOW THE THEME SYSTEM WORKS ──────────────────────────────────────────────
//
// The app supports two appearances: "dark" (default) and "light". The choice
// is stored in localStorage under THEME_STORAGE_KEY and applied by toggling a
// "light" class on <html>. Dark mode requires no class — it is the default via
// `color-scheme: dark` in app/globals.css.
//
// The full data flow, from first paint to user toggle:
//
//  1. SERVER RENDER
//     Next.js renders <html> without the "light" class. The page arrives dark.
//
//  2. BEFORE HYDRATION — no-flash bootstrap (app/layout.tsx)
//     An inline <script> in <head> runs synchronously before any JS bundle
//     loads. It reads localStorage[THEME_STORAGE_KEY]:
//       • "light" or "dark" → use that stored preference.
//       • anything else (null, first visit) → check
//         window.matchMedia("(prefers-color-scheme: light)").
//     If the resolved theme is light, it adds class="light" to <html>.
//     This happens before the browser paints, so there is no flash of the
//     wrong theme. suppressHydrationWarning on <html> silences React's
//     hydration mismatch (the server rendered without "light"; the client may
//     have added it).
//
//  3. HYDRATION — ThemeProvider (components/theme-provider.tsx)
//     ThemeProvider initialises its React state by reading the DOM result
//     of step 2 (document.documentElement.classList.contains("light")),
//     not by re-running the bootstrap logic. This keeps React state in sync
//     with whatever the bootstrap script already applied.
//
//  4. RUNTIME TOGGLE — ThemeToggle (components/theme-toggle.tsx)
//     Calls toggleTheme() from useTheme(). ThemeProvider's useEffect responds:
//       a. document.documentElement.classList.toggle("light", theme === "light")
//       b. localStorage.setItem(THEME_STORAGE_KEY, theme)
//
//  5. CSS — app/globals.css
//     Tailwind v4 compiles every neutral-* utility to var(--color-neutral-*).
//     The :root.light block inverts the neutral ramp (950↔50, 900↔100, …),
//     so background, surface, border, and text swap roles automatically.
//     Semantic colours (red, green, indigo, etc.) are unchanged in both themes.
//
// ─── ADDING A NEW THEME ───────────────────────────────────────────────────────
//
// The Theme type is a union — extend it here, add a branch to otherTheme(),
// update the :root.[theme] block in globals.css, and update the bootstrap
// script in app/layout.tsx to detect and apply the new class on first paint.

export type Theme = "dark" | "light";

// localStorage key the theme choice is persisted under. Shared by the
// no-flash bootstrap script in app/layout.tsx and components/theme-provider.tsx
// — keep both in sync with this value.
export const THEME_STORAGE_KEY = "trickle-theme";

/**
 * Resolves the theme to render given an optional stored preference and the
 * OS-level color-scheme preference.
 *
 * Priority:
 *   1. A valid stored value ("light" or "dark") — the user has explicitly chosen.
 *   2. The OS preference (prefers-color-scheme) — honour the system default.
 *
 * Kept free of DOM and storage access so it can be unit tested directly. The
 * bootstrap script in app/layout.tsx and ThemeProvider both implement the same
 * rule; this function is the single testable source of truth for that logic.
 */
export function resolveInitialTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersLight ? "light" : "dark";
}

/** Returns the other theme — used by ThemeProvider's toggleTheme(). */
export function otherTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}
