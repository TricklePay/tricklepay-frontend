/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadCsv } from "@/lib/csv-download";

function readBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("downloadCsv", () => {
  const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(() => "blob:mock-url");
  const revokeObjectURL = vi.fn<(url: string) => void>();

  beforeEach(() => {
    // jsdom does not implement the object URL functions.
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    document.body.innerHTML = "";
  });

  it("clicks an anchor with the filename and a blob with a UTF-8 BOM and CSV MIME type", async () => {
    const clicked: { download: string; href: string; inDom: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      const link = document.body.querySelector("a");
      clicked.push({
        download: link?.download ?? "",
        href: link?.href ?? "",
        inDom: link !== null,
      });
    });

    downloadCsv("streams.csv", "a,b\n1,2");

    expect(clicked).toEqual([{ download: "streams.csv", href: "blob:mock-url", inDom: true }]);

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    const bytes = await readBytes(blob);
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(String.fromCharCode(...bytes.slice(3))).toBe("a,b\n1,2");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("revokes the object URL even if the click throws", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });

    expect(() => downloadCsv("streams.csv", "a")).toThrow("click failed");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("removes the anchor from the DOM after the click", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadCsv("streams.csv", "a");

    expect(document.body.querySelector("a")).toBeNull();
  });
});
