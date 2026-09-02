---
status: todo
---
# Visual Regression Tests

## Description
Add automated Playwright screenshot-comparison tests covering this app's real composed output — the 2D background preview canvas for a real stage, and the 3D model-based stage preview — loaded from real stage fixtures. See roadmap decision `024-visual-regression-testing-via-playwright-screenshots.md` for the shared approach.

## Acceptance Criteria
- [ ] The app's Playwright config extends `web-ui-kit`'s shared visual-testing config/fixture
- [ ] Baseline screenshots exist for: a real 2D stage's composed background preview (including `Dengeki_Subway`, once backlog item `009-apply-bgdef-xscale-yscale-in-background-composition` lands — this becomes the regression guard against that exact bug recurring), and a real 3D model-based stage's rendered preview
- [ ] `npm run test:visual` runs these in CI as its own job, separate from `npm test`, and fails the build on a diff
- [ ] A real, deliberate composition regression (verified by temporarily reverting the `xscale`/`yscale` fix or otherwise breaking a covered path, then reverting back) is caught by this suite

## Notes
Depends on `web-ui-kit` backlog item `013-visual-regression-shared-playwright-config-and-component-snapshots` landing first. Sequencing note: land after (or alongside) backlog item `010-real-stage-corpus-rendering-sanity-test` — that item catches "is this plausible at all" across the whole real corpus at the composition-math level (no browser needed); this item catches "does it look pixel-right" for a small set of specific real stages at the actual rendered-canvas level. The two are complementary, not redundant.
