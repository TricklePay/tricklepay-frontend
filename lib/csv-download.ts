// Triggers a browser file download for CSV content built by lib/csv.ts. Pure
// DOM glue (Blob + a throwaway anchor) kept separate from the CSV-building
// logic, which is unit tested on its own without a DOM.

export function downloadCsv(filename: string, csv: string): void {
  // A leading UTF-8 BOM so Excel (which otherwise guesses the system's
  // default code page) opens the file as UTF-8 rather than mangling any
  // non-ASCII characters in an address or token symbol.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // some browsers start the download async, so revoking right away can break it
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
