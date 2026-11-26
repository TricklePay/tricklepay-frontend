"use client";

import { type FormEvent, type JSX, useEffect, useState } from "react";

import {
  ADDRESS_LABELS_CHANGED_EVENT,
  MAX_LABEL_LENGTH,
  readAddressLabels,
  removeAddressLabel,
  setAddressLabel,
} from "@/lib/address-labels";
import { truncateAddress } from "@/lib/format";

function useAddressLabel(address: string): string | undefined {
  const [label, setLabel] = useState<string | undefined>(undefined);

  // Read after mount so the server markup and first client render agree.
  useEffect(() => {
    const sync = () => setLabel(readAddressLabels()[address]);
    sync();
    window.addEventListener(ADDRESS_LABELS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ADDRESS_LABELS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [address]);

  return label;
}

const smallButton =
  "rounded border border-neutral-700 px-2 py-0.5 font-sans text-[10px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

/**
 * A truncated address with the user's own label beside it. The full address
 * stays in the tooltip. With `editable`, shows controls to add, edit or remove
 * the label.
 */
export function AddressWithLabel({
  address,
  editable = false,
}: {
  address: string;
  editable?: boolean;
}): JSX.Element {
  const label = useAddressLabel(address);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(label ?? "");
    setEditing(true);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    setAddressLabel(address, draft);
    setEditing(false);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2" title={address}>
      <span>
        {label && <span className="mr-1 font-sans font-medium text-neutral-100">{label}</span>}
        <span className={label ? "text-neutral-500" : undefined}>
          {label ? `(${truncateAddress(address)})` : truncateAddress(address)}
        </span>
      </span>
      {editable && !editing && (
        <button type="button" onClick={startEditing} className={smallButton}>
          {label ? "Edit label" : "Add label"}
        </button>
      )}
      {editable && !editing && label && (
        <button type="button" onClick={() => removeAddressLabel(address)} className={smallButton}>
          Remove label
        </button>
      )}
      {editable && editing && (
        <form onSubmit={save} className="inline-flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LABEL_LENGTH}
            aria-label="Label for this address"
            className="w-36 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 font-sans text-xs text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          />
          <button type="submit" className={smallButton}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={smallButton}>
            Cancel
          </button>
        </form>
      )}
    </span>
  );
}
