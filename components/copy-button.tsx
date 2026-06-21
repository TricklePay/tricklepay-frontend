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
      title={`Copy ${label ?? "value"}`}
      className="text-xs text-neutral-500 hover:text-neutral-300"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
