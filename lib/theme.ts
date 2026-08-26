export type Theme = "dark" | "light";

// localStorage key the theme choice is persisted under. Shared by the
// no-flash bootstrap script in app/layout.tsx and components/theme-provider.tsx
// — keep both in sync with this value.
export const THEME_STORAGE_KEY = "trickle-theme";

// Pure decision logic for which theme to render, given an optional persisted
// choice and the OS-level color-scheme preference. Kept free of DOM/storage
// access so it can be unit tested directly; the bootstrap script and
// ThemeProvider both apply this same rule.
export function resolveInitialTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersLight ? "light" : "dark";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}
