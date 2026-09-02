"use client";

import { useState } from "react";


/**
 * A small button that copies a value to the clipboard and briefly confirms.
 * Used to copy full addresses that are shown truncated.
 * 
 * @param value - The string to copy to the clipboard.
 * @param label - Optional descriptive label for accessibility. Defaults to "value".
 */
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
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 ${
        copied
          ? "text-green-400"
          : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `Copied ${label ?? "value"} to clipboard` : ""}
      </span>
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

/**
 * A button that shares a stream link via the Web Share API (if available) or
 * copies it to the clipboard as a fallback. Provides visual feedback when
 * the action succeeds.
 * 
 * @param url - The URL to share or copy.
 * @param label - Optional descriptive label for accessibility. Defaults to "stream link".
 */
export function ShareLinkButton({ url, label = "stream link" }: { url: string; label?: string }) {
  const [shared, setShared] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "TricklePay stream",
          text: `Check out this stream: ${label}`,
          url,
        });
        setShared(true);
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
    } catch {
      // Insecure contexts or user cancellation: silently ignore the failure.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      title={shared ? `Share link copied` : `Share ${label}`}
      aria-label={shared ? `Share link copied` : `Share ${label}`}
      className="inline-flex items-center gap-2 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {shared ? `Stream link copied or shared` : ""}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M9.5 2.5a2 2 0 0 1 1.988 2.188L9.828 6.1a2.5 2.5 0 0 1-.295.5l2.64 1.547a2 2 0 1 1-.396.91L9.137 7.5a2.5 2.5 0 0 1-2.375 1.448L6.5 11.07a2 2 0 1 1-.174-1.09l.262-.13A2.5 2.5 0 0 1 9.12 8.5l2.64-1.547A2 2 0 1 1 9.5 2.5Z"/>
      </svg>
      {shared ? "Link shared" : "Share link"}
    </button>
  );
}
