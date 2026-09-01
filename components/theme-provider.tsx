"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { otherTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
};

const ThemeContext = createContext<ThemeState | null>(null);

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

// Owns the app-wide light/dark preference. The initial theme is already
// applied to <html> synchronously, before hydration, by the inline bootstrap
// script in app/layout.tsx (so there is no flash of the wrong theme) — this
// provider just reads that resulting DOM state and keeps it, localStorage,
// and React state in sync from then on.
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  });

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
