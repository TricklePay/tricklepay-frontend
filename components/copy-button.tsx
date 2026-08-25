"use client";

import { useState } from "react";

// A small button that copies a value to the clipboard and briefly confirms.
// Used to copy full addresses that are shown truncated.
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (for example, an insecure context); ignore.
    }
  }

  return (
    <button
      onClick={() => void copy()}
      title={copied ? `Copied ${label ?? "value"}!` : `Copy ${label ?? "value"}`}
      aria-label={copied ? `Copied ${label ?? "value"}` : `Copy ${label ?? "value"}`}
      aria-live="polite"
      className={`inline-flex items-center gap-1 text-xs transition-colors duration-150 ${
        copied
          ? "text-green-400"
          : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {copied ? (
        <>
          {/* Checkmark icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            className="h-3 w-3"
          >
            <path
              fillRule="evenodd"
              d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
          copied
        </>
      ) : (
        <>
          {/* Clipboard icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            className="h-3 w-3"
          >
            <path
              fillRule="evenodd"
              d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5V4H13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5v-.5Zm1.5 0v.5h2v-.5a.5.5 0 0 0-.5-.5H7.5a.5.5 0 0 0-.5.5Z"
              clipRule="evenodd"
            />
          </svg>
          copy
        </>
      )}
    </button>
  );
}
