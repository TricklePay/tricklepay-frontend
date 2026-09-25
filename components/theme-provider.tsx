"use client";

// Owns the app-wide light/dark preference in React state and keeps it in sync
// with the DOM class and localStorage. See lib/theme.ts for the full data-flow
// description and the reasoning behind each design choice.
//
// RESPONSIBILITIES OF THIS FILE
//
//   applyThemeClass(theme)
//     The single place that writes to the DOM. Adds "light" to
//     document.documentElement.classList for the light theme; removes it for
//     dark. Dark requires no class because globals.css defaults to dark.
//
//   ThemeProvider
//     Initialises React state from the DOM (not from localStorage directly)
//     so it reflects whatever the no-flash bootstrap script already applied.
//     A useEffect keeps the DOM class and localStorage entry in sync whenever
//     the theme changes. Storage failures (private browsing, quota exceeded)
//     are caught and ignored — the theme still works for the current session.
//
//   useTheme()
//     The public hook for reading and toggling the theme. Throws if called
//     outside ThemeProvider so the error is obvious at development time rather
//     than silently returning a default.
//
// WHAT NOT TO DO
//
//   Do not call applyThemeClass outside this file — ThemeProvider's useEffect
//   is the only writer. Reading the theme elsewhere is fine via useTheme().
//
//   Do not duplicate the localStorage key string. Import THEME_STORAGE_KEY
//   from lib/theme.ts wherever you need it.

import { type JSX, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { otherTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

// Owns the app-wide light/dark preference. The initial theme is already
// applied to <html> synchronously, before hydration, by the inline bootstrap
// script in app/layout.tsx (so there is no flash of the wrong theme) — this
// provider reads the resulting DOM state to initialise React, then keeps React
// state, the DOM class, and localStorage in sync from that point on.
export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  // Read from the DOM, not from localStorage, so React's initial state matches
  // whatever the bootstrap script already applied. Reading localStorage here
  // would race with the bootstrap script and could cause a one-frame mismatch.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  });

  // Keep the DOM class and localStorage in sync after every theme change.
  // This is the single writer for both; nothing else should touch them directly.
  useEffect(() => {
    applyThemeClass(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private browsing, disabled); theme just won't persist.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => otherTheme(t));
  }, []);

  const value = useMemo<ThemeState>(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider.");
  return ctx;
}
