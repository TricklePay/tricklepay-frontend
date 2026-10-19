class MockStorage implements Storage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}

// Fix cross-realm Uint8Array / Buffer instanceof check for noble-hashes in jsdom
try {
  const origHasInstance = Uint8Array[Symbol.hasInstance];
  Object.defineProperty(Uint8Array, Symbol.hasInstance, {
    value: function (inst: unknown) {
      if (origHasInstance && origHasInstance.call(this, inst)) return true;
      return (
        inst !== null &&
        typeof inst === "object" &&
        ((inst as { constructor?: { name?: string } }).constructor?.name === "Buffer" ||
          (inst as { _isBuffer?: boolean })._isBuffer === true)
      );
    },
    configurable: true,
  });
} catch {}

// Ensure React knows act() is supported in test environment
// @ts-expect-error IS_REACT_ACT_ENVIRONMENT is a global flag for React
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
