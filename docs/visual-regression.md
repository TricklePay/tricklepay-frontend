# Visual Regression Suite

This document describes the visual regression (smoke) suite for the TricklePay frontend, what it covers, how to deliberately update a snapshot, and how to review a visual diff.

## What the Suite Covers

The visual suite captures snapshots of key rendered views and components so that unintended visual changes are detected early. It is a smoke test, not an exhaustive visual coverage tool. It focuses on the high-value surfaces most likely to regress or to be affected by shared styling changes:

- Top-level page layouts and routing outlets (e.g. landing, dashboard, and auth flows).
- Core UI components and their variants (buttons, inputs, modals, cards, alerts, and navigation).
- Representative states for each component, including default, hover/focus where applicable, disabled, loading, and error states.
- Responsive breakpoints for the layouts that are covered.
- Theme variations (light and dark) where the app supports them.

Snapshots are committed to the repository and are treated as artifacts of the codebase. A change to a snapshot is a visible change to the app and must be justified in the pull request.

## Running the Suite

Run the visual suite as part of the standard test command:

```bash
npm test
```

To run only the visual suite locally, use the dedicated script:

```bash
npm run test:visual
`if

A non-zero exit code means one or more snapshots differ from the committed baseline. The report artifacts (image diffs, expected images, and actual images) are written to the configured output directory so you can inspect them.

## Updating a Snapshot Deliberately

Update a snapshot only when the visual change is intentional and reviewed. The typical workflow is:

1. Make the code change that alters the rendered output.
2. Run the visual suite and inspect the reported diffs.
3. Confirm each diff is expected and explainable by your change.
4. Regenerate the baselines with the update command:

   ```bash
   npm run test:visual -- --update-snapshots
   ```

   If the suite uses a separate update script, use `npm run test:visual:update` instead.
5. Re-run the suite without the update flag to confirm it passes against the new baselines.
6. Commit the updated snapshot files alongside the code change that caused them.

The update command rewrites the committed baseline images. Treat those files as part of the change under review, not as generated noise.

## Reviewing a Visual Diff

When a pull request changes a snapshot, review the diff before approving:

1. Open the diff report from the test run or the committed snapshot changes in the pull request.
2. Compare the expected image against the actual image and examine the diff overlay to locate what moved, resized, recolored, or disappeared.
3. Confirm the change matches the intent of the code change and does not introduce unintended effects in other components.
4. Check that the change is consistent across the covered breakpoints and themes.
5. If anything is unexplained, request changes rather than accepting the new baseline.

## Why You Must Not Update Snapshots to Silence a Failure

Never regenerate a snapshot just to make a failing test pass. A failing snapshot is evidence that the rendered output changed. Overwriting the baseline without understanding the cause hides regressions, makes the suite meaningless, and ships unintended visual changes to users.

If a snapshot fails unexpectedly:

- Investigate the root cause before changing any baseline.
- Check for unintended style, layout, or dependency changes.
- Fix the code if the change was a regression.
- Only update the snapshot when the new output is the intended result, and say so in the pull request description.

A snapshot update without a corresponding, justified code change is a redflag in review and should be rejected.
