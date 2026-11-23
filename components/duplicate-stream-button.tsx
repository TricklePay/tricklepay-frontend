"use client";

import { useRouter } from "next/navigation";
import { useId, type JSX } from "react";

import { writeFormDraft } from "@/lib/create-form-draft";
import { buildDuplicateDraft } from "@/lib/duplicate-stream";
import type { StreamView } from "@/types/stream";

interface Props {
  stream: StreamView;
}

/**
 * A button visible only to the stream sender. Clicking it pre-fills the
 * create form with the same recipient, token, and amount, but shifts the
 * schedule to start from now while preserving the original duration and cliff
 * offset, then navigates to /create.
 */
export function DuplicateStreamButton({ stream }: Props): JSX.Element {
  const router = useRouter();
  const descriptionId = useId();

  function handleDuplicate() {
    const draft = buildDuplicateDraft(stream);
    writeFormDraft(draft);
    router.push("/create");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDuplicate}
        aria-describedby={descriptionId}
        className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1"
      >
        {/* Duplicate / copy icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="h-3 w-3"
        >
          <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5V4H13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5v-.5Zm1.5 0v.5h2v-.5a.5.5 0 0 0-.5-.5H7.5a.5.5 0 0 0-.5.5Z" />
        </svg>
        Duplicate stream
      </button>
      <span id={descriptionId} className="sr-only">
        Open the create form prefilled with the same details.
      </span>
    </>
  );
}
