"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="inline-flex items-center justify-center rounded border border-neutral-700 p-1.5 text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
    >
      {isLight ? (
        /* moon icon — currently light, click to switch to dark */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M6.5 1.5a.75.75 0 0 1 .686 1.05 5.5 5.5 0 0 0 7.264 7.264.75.75 0 0 1 .978.978A7 7 0 1 1 5.522.522.75.75 0 0 1 6.5 1.5Z" />
        </svg>
      ) : (
        /* sun icon — currently dark, click to switch to light */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1Zm0 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM2.343 3.343a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.06Zm10.253 0a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.06a.75.75 0 0 1 1.061 0ZM1 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 1 8Zm11.75 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75ZM4.464 11.475a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0Zm7.132 0a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 1 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM8 13.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V14a.75.75 0 0 1 .75-.75Z" />
        </svg>
      )}
    </button>
  );
}
