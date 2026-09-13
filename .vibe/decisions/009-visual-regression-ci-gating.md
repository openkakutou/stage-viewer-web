---
date: 2026-09-13
status: accepted
---
# Visual regression CI gating

**Context:** Backlog item 011 requires `npm run test:visual` to run in CI
as its own step and fail the build on a diff. This repo has a single CI
workflow (`deploy-pages.yml`, one `build` job running Test/Lint/Build,
then a `deploy` job that `needs: build`), unlike sibling `web-ui-kit`'s
3-workflow split (`ci.yml`/reusable `verify.yml`/`release.yml`) built
around its own always-on PR pipeline.

**Decision:** Add "Cache Playwright browsers"/"Install Playwright
browsers"/"Visual regression tests"/"Upload visual regression diff" as new
steps in the existing `build` job, after `Build` and before `Configure
Pages` — not a separate job or workflow file. Pin that job's `runs-on`
from `ubuntu-latest` to `ubuntu-24.04`. No bypass/override path: a failing
visual check blocks `deploy` (which `needs: build`) exactly the way a
failing `Test`/`Lint`/`Build` step already does today, with no separate
"publish anyway" mechanism.

**Reason:** This repo only ever runs one workflow, on push to `main`, with
no separate PR-stage pipeline to add a check to instead — folding into the
existing single job keeps the change proportionate to that shape rather
than introducing a second workflow file/job purely for this item. Pinning
the runner image matters specifically *because* this job now also carries
committed screenshot baselines: a floating `ubuntu-latest` image bump
changes fontconfig/freetype and software-GL rendering with no code change
on this repo's side, which would silently invalidate every baseline —
`web-ui-kit`'s own `.vibe/decisions/015` hit exactly this and pinned for
the same reason. No bypass matches the acceptance criteria's explicit
"fails the build on a diff" wording and this org's existing convention
(`web-ui-kit`'s own `release.yml` has no override on its equivalent gate
either) — a stale/flaky baseline is fixed by regenerating and committing
it (`npm run test:visual:update`), the same remedy as a failing unit test,
not by adding an escape hatch.

**Rejected alternatives:**
- A separate reusable-workflow split mirroring `web-ui-kit`'s three-file
  shape — rejected as disproportionate: that shape exists there to serve
  an always-on PR pipeline this repo doesn't have; adding one is a
  larger, unrelated CI restructuring, not this item's scope.
- A "warning-only"/non-blocking visual step, or a manual override to
  deploy past a failing one — rejected: contradicts the acceptance
  criteria directly, and this repo has no existing "redeploy last good
  build" mechanism to fall back on if a bad build were allowed through.
