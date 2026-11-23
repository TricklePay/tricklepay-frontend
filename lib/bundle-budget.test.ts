import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import { checkBundleBudget } from "../scripts/check-bundle-budget.mjs";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tricklepay-budget-"));
  tempDirs.push(dir);
  return dir;
}

function writeChunk(nextDir: string, relPath: string, content: string): number {
  const fullPath = path.join(nextDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return zlib.gzipSync(Buffer.from(content, "utf8"), { level: 9 }).byteLength;
}

function writeManifest(nextDir: string, pages: Record<string, string[]>): void {
  fs.mkdirSync(nextDir, { recursive: true });
  fs.writeFileSync(
    path.join(nextDir, "app-build-manifest.json"),
    JSON.stringify({ pages }, null, 2),
    "utf8",
  );
}

function writeBudget(
  rootDir: string,
  routes: Array<{ route: string; manifestKey: string; limitBytes: number }>,
): string {
  const budgetPath = path.join(rootDir, "bundle-budget.json");
  fs.writeFileSync(
    budgetPath,
    JSON.stringify({ measure: "gzip-level-9-bytes", routes }, null, 2),
    "utf8",
  );
  return budgetPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("checkBundleBudget", () => {
  it("passes when all routes are below budget", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    const sizeA = writeChunk(nextDir, "static/chunks/a.js", "console.log('a');");
    const sizeB = writeChunk(nextDir, "static/chunks/b.js", "console.log('b');");
    writeManifest(nextDir, {
      "/page": ["static/chunks/a.js"],
      "/create/page": ["static/chunks/a.js", "static/chunks/b.js"],
    });
    const budgetPath = writeBudget(rootDir, [
      { route: "/", manifestKey: "/page", limitBytes: sizeA + 50 },
      { route: "/create", manifestKey: "/create/page", limitBytes: sizeA + sizeB + 50 },
    ]);

    const outcome = checkBundleBudget({ budgetPath, nextDir });
    expect(outcome.passed).toBe(true);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[0].actualBytes).toBe(sizeA);
    expect(outcome.results[1].actualBytes).toBe(sizeA + sizeB);
  });

  it("passes when a route is exactly at the budget", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    const sizeA = writeChunk(nextDir, "static/chunks/a.js", "console.log('exact');");
    writeManifest(nextDir, { "/page": ["static/chunks/a.js"] });
    const budgetPath = writeBudget(rootDir, [
      { route: "/", manifestKey: "/page", limitBytes: sizeA },
    ]);

    const outcome = checkBundleBudget({ budgetPath, nextDir });
    expect(outcome.passed).toBe(true);
    expect(outcome.results[0].diffBytes).toBe(0);
  });

  it("fails with route, actual, budget, and difference when above budget", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    const sizeA = writeChunk(nextDir, "static/chunks/a.js", "console.log('too big payload');");
    writeManifest(nextDir, { "/page": ["static/chunks/a.js"] });
    const limitBytes = sizeA - 5;
    const budgetPath = writeBudget(rootDir, [
      { route: "/", manifestKey: "/page", limitBytes },
    ]);

    const outcome = checkBundleBudget({ budgetPath, nextDir });
    expect(outcome.passed).toBe(false);
    expect(outcome.results[0].ok).toBe(false);
    expect(outcome.results[0].diffBytes).toBe(5);
    expect(outcome.messages[0]).toContain("FAIL /");
    expect(outcome.messages[0]).toContain(`${sizeA} B`);
    expect(outcome.messages[0]).toContain(`${limitBytes} B`);
    expect(outcome.messages[0]).toContain("+5 B");
  });

  it("counts shared or duplicate chunks only once per route and ignores non-JS files", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    const sharedSize = writeChunk(nextDir, "static/chunks/shared.js", "export const x = 1;");
    writeChunk(nextDir, "static/css/app.css", "body { color: white; }");
    writeManifest(nextDir, {
      "/page": [
        "static/chunks/shared.js",
        "static/chunks/shared.js",
        "static/css/app.css",
      ],
    });
    const budgetPath = writeBudget(rootDir, [
      { route: "/", manifestKey: "/page", limitBytes: sharedSize },
    ]);

    const outcome = checkBundleBudget({ budgetPath, nextDir });
    expect(outcome.passed).toBe(true);
    expect(outcome.results[0].actualBytes).toBe(sharedSize);
    expect(outcome.results[0].chunkCount).toBe(1);
  });

  it("throws an actionable error when the build manifest is missing", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    const budgetPath = writeBudget(rootDir, [
      { route: "/", manifestKey: "/page", limitBytes: 1000 },
    ]);

    expect(() => checkBundleBudget({ budgetPath, nextDir })).toThrow(
      /Missing Next\.js build manifest/,
    );
  });

  it("throws an actionable error when a budgeted route is missing from the manifest", () => {
    const rootDir = makeTempDir();
    const nextDir = path.join(rootDir, ".next");
    writeManifest(nextDir, { "/page": [] });
    const budgetPath = writeBudget(rootDir, [
      { route: "/create", manifestKey: "/create/page", limitBytes: 1000 },
    ]);

    expect(() => checkBundleBudget({ budgetPath, nextDir })).toThrow(
      /Route "\/create" \(manifest key "\/create\/page"\) was not found/,
    );
  });
});
