import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const GZIP_LEVEL = 9;

/**
 * Formats a byte count with both exact bytes and KiB for readable CI output.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  const kib = (bytes / 1024).toFixed(2);
  return `${bytes} B (${kib} KiB)`;
}

/**
 * Reads and parses `.next/app-build-manifest.json`.
 * @param {string} nextDir
 * @returns {{ pages: Record<string, string[]> }}
 */
export function readAppBuildManifest(nextDir) {
  const manifestPath = path.join(nextDir, "app-build-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing Next.js build manifest at ${manifestPath}. Run "npm run build" before checking the bundle budget.`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse build manifest at ${manifestPath}: ${message}`);
  }

  if (!parsed || typeof parsed !== "object" || !parsed.pages || typeof parsed.pages !== "object") {
    throw new Error(`Invalid build manifest at ${manifestPath}: missing "pages" map.`);
  }

  return parsed;
}

/**
 * Computes the total gzipped (level 9) byte size of all unique JS chunks
 * required by a route's entry in `app-build-manifest.json`.
 * @param {string} nextDir
 * @param {{ pages: Record<string, string[]> }} manifest
 * @param {string} route
 * @param {string} manifestKey
 * @returns {{ actualBytes: number, chunkCount: number }}
 */
export function computeRouteFirstLoadBytes(nextDir, manifest, route, manifestKey) {
  const entries = manifest.pages[manifestKey];
  if (!Array.isArray(entries)) {
    throw new Error(
      `Route "${route}" (manifest key "${manifestKey}") was not found in ${path.join(nextDir, "app-build-manifest.json")}.`,
    );
  }

  const uniqueJsChunks = new Set(
    entries.filter((entry) => typeof entry === "string" && entry.endsWith(".js")),
  );

  let actualBytes = 0;
  for (const chunkRelPath of uniqueJsChunks) {
    const chunkAbsPath = path.join(nextDir, chunkRelPath);
    if (!fs.existsSync(chunkAbsPath)) {
      throw new Error(
        `Missing JS chunk "${chunkRelPath}" for route "${route}" at ${chunkAbsPath}. Re-run "npm run build".`,
      );
    }
    const content = fs.readFileSync(chunkAbsPath);
    actualBytes += zlib.gzipSync(content, { level: GZIP_LEVEL }).byteLength;
  }

  return { actualBytes, chunkCount: uniqueJsChunks.size };
}

/**
 * Checks all routes in the budget config against the Next.js build output.
 * @param {{ budgetPath: string, nextDir: string }} options
 * @returns {{ passed: boolean, results: Array<{ route: string, manifestKey: string, actualBytes: number, limitBytes: number, diffBytes: number, chunkCount: number, ok: boolean }>, messages: string[] }}
 */
export function checkBundleBudget({ budgetPath, nextDir }) {
  if (!fs.existsSync(budgetPath)) {
    throw new Error(`Missing bundle budget config at ${budgetPath}.`);
  }

  const budgetConfig = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
  if (!budgetConfig || !Array.isArray(budgetConfig.routes) || budgetConfig.routes.length === 0) {
    throw new Error(`Invalid bundle budget config at ${budgetPath}: "routes" must be a non-empty array.`);
  }

  const manifest = readAppBuildManifest(nextDir);
  const results = [];
  const messages = [];
  let passed = true;

  for (const entry of budgetConfig.routes) {
    const { route, manifestKey, limitBytes } = entry;
    if (typeof route !== "string" || typeof manifestKey !== "string" || typeof limitBytes !== "number" || limitBytes <= 0) {
      throw new Error(`Invalid route budget entry in ${budgetPath}: ${JSON.stringify(entry)}`);
    }

    const { actualBytes, chunkCount } = computeRouteFirstLoadBytes(
      nextDir,
      manifest,
      route,
      manifestKey,
    );
    const diffBytes = actualBytes - limitBytes;
    const ok = actualBytes <= limitBytes;

    if (!ok) {
      passed = false;
      messages.push(
        `FAIL ${route}: actual ${formatBytes(actualBytes)} exceeds budget ${formatBytes(limitBytes)} by +${formatBytes(diffBytes)} (${chunkCount} unique JS chunks, gzip level ${GZIP_LEVEL}).`,
      );
    } else {
      const remaining = limitBytes - actualBytes;
      messages.push(
        `PASS ${route}: actual ${formatBytes(actualBytes)} within budget ${formatBytes(limitBytes)} (${formatBytes(remaining)} remaining, ${chunkCount} unique JS chunks, gzip level ${GZIP_LEVEL}).`,
      );
    }

    results.push({ route, manifestKey, actualBytes, limitBytes, diffBytes, chunkCount, ok });
  }

  return { passed, results, messages };
}

function main() {
  const rootDir = process.cwd();
  const budgetPath = path.join(rootDir, "bundle-budget.json");
  const nextDir = path.join(rootDir, ".next");

  try {
    const { passed, messages } = checkBundleBudget({ budgetPath, nextDir });
    for (const line of messages) {
      if (line.startsWith("FAIL")) {
        console.error(line);
      } else {
        console.log(line);
      }
    }
    if (!passed) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
