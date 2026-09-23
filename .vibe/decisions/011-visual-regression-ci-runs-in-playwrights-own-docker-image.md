# 011 — Visual regression CI runs in Playwright's own Docker image

## Context

`.vibe/decisions/009` pinned the `build` job to `ubuntu-24.04` (instead of
the floating `ubuntu-latest`) specifically to stop a periodic runner-image
bump from silently invalidating the committed visual-regression baselines.
That mitigates *drift over time*, but not the mismatch that actually hit:
the 2026-09-21 push failed the "2D real stage (Dengeki_Subway)" baseline
with `Expected an image 960px by 515px, received 951px by 511px` — a
one-off dimension diff against whatever machine originally captured that
baseline, on the very same pinned OS. `playwright install --with-deps
chromium` on a given OS doesn't guarantee byte-identical font-rendering to
another machine's install of the same package, only to *itself* run
again on the same OS build. The identical root cause, more consistently
reproducible, was found and fixed first in the sibling
`character-viewer-web`/`character-editor` repos (their own
`.vibe/decisions/023`/`018`).

Separately, that same CI run's other spec ("3D model-based real stage")
was seen to occasionally time out on `.background-preview__stack`
becoming visible (5s default) under CPU contention — a real margin
problem given each spec loads two real WASM modules and, for the 3D
fixture, decodes/renders a real glTF model, not stubbed work.

## Decision

The `build` job now runs inside Playwright's own published Docker image
(`mcr.microsoft.com/playwright`, pinned to this repo's exact
`@playwright/test` version, referenced by digest) instead of pinning the
bare OS and installing Chromium onto it. This supersedes the `ubuntu-24.04`
pin from decision 009 — the image itself is now the fixed point, and it
bundles a matching Chromium + font set. The "Cache/Install Playwright
browsers" steps are removed.

`playwright.config.ts`'s shared visual preset override now also sets an
explicit `expect: { timeout: 15_000 }`, above the implicit 5s default, to
give the real WASM-load-and-decode path enough headroom.

Both affected baselines were regenerated through that same image, then
confirmed stable across three more clean runs inside the container with
no `--update-snapshots`.

## Consequence

Bumping `@playwright/test` in `package.json` must be paired with bumping
the image tag/digest in `.github/workflows/deploy-pages.yml`, and every
baseline regenerated through the new image before merging. See
`docs/testing.md` for the regeneration command.
