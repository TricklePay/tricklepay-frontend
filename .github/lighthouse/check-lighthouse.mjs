#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const LIGHTHOUSE_VERSION = "13.6.0";
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? "http://127.0.0.1:3000";
const REPORT_DIR = path.resolve(process.env.LIGHTHOUSE_REPORT_DIR ?? "lighthouse-reports");
const CONFIG_PATH = path.resolve(".github/lighthouse/config.json");

const PAGES = [
  { name: "dashboard", path: "/" },
  { name: "create", path: "/create" },
];

// Category score floors (0..1). Adjust after observing the first CI baseline if needed.
const CATEGORY_FLOORS = {
  accessibility: 0.9,
  "best-practices": 0.9,
};

// Specific accessibility audits that must pass (score === 1) or be notApplicable.
const REQUIRED_AUDITS = [
  "color-contrast",
  "label",
  "button-name",
  "link-name",
  "image-alt",
  "html-has-lang",
  "document-title",
];

mkdirSync(REPORT_DIR, { recursive: true });

const failures = [];
const summaryRows = [];

for (const page of PAGES) {
  const url = `${BASE_URL}${page.path}`;
  const outPrefix = path.join(REPORT_DIR, page.name);

  console.log(`\nRunning Lighthouse ${LIGHTHOUSE_VERSION} on ${page.name} (${url})...`);

  execFileSync(
    "npx",
    [
      "--yes",
      `lighthouse@${LIGHTHOUSE_VERSION}`,
      url,
      `--config-path=${CONFIG_PATH}`,
      "--output=json",
      "--output=html",
      `--output-path=${outPrefix}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage",
      "--quiet",
    ],
    {
      stdio: "inherit",
      timeout: 120_000,
      env: {
        ...process.env,
        // Avoid running lifecycle scripts when npx downloads Lighthouse at CI time.
        npm_config_ignore_scripts: "true",
      },
    },
  );

  const report = JSON.parse(readFileSync(`${outPrefix}.report.json`, "utf8"));

  const a11yScore = report.categories?.accessibility?.score ?? 0;
  const bpScore = report.categories?.["best-practices"]?.score ?? 0;

  summaryRows.push(
    `| ${page.name} (\`${page.path}\`) | ${Math.round(a11yScore * 100)} | ${Math.round(bpScore * 100)} |`,
  );

  for (const [catId, floor] of Object.entries(CATEGORY_FLOORS)) {
    const score = report.categories?.[catId]?.score;
    if (typeof score !== "number" || score < floor) {
      failures.push(
        `Page "${page.name}" (${page.path}): category "${catId}" scored ${score ?? "null"} (below floor ${floor})`,
      );
    }
  }

  for (const auditId of REQUIRED_AUDITS) {
    const audit = report.audits?.[auditId];
    if (!audit) {
      failures.push(`Page "${page.name}" (${page.path}): required audit "${auditId}" missing from report`);
      continue;
    }
    const mode = audit.scoreDisplayMode;
    if (mode === "notApplicable" || mode === "informative") continue;
    if (audit.score !== 1) {
      failures.push(
        `Page "${page.name}" (${page.path}): audit "${auditId}" scored ${audit.score} (expected 1)`,
      );
    }
  }
}

const summaryText = [
  "## Lighthouse Results",
  "",
  "| Page | Accessibility | Best Practices |",
  "| --- | --- | --- |",
  ...summaryRows,
  "",
].join("\n");

console.log(`\n${summaryText}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summaryText}\n`, "utf8");
}

if (failures.length > 0) {
  console.error("\nLighthouse check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("All Lighthouse category floors and required audits passed.");
