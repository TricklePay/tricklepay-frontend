"use client";

import { type FormEvent, useState } from "react";

import { streamHrefForInput } from "@/lib/validation";

/** A small box on the dashboard that opens a stream by its id. */
export function GoToStream({ onGo }: { onGo: (href: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    onGo(streamHrefForInput(value));
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex items-center gap-2">
      <label className="flex-1">
        <span className="sr-only">Go to stream by ID</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Go to stream ID…"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="w-full max-w-sm rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus-visible:outline-none"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center min-h-[44px] rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
      >
        Go
      </button>
    </form>
  );
}
