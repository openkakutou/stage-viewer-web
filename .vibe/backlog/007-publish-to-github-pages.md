---
status: todo
---
# Publish to GitHub Pages

## Description
This is a static site (no backend) with no hosting story today — nothing here is reachable at a URL. Add a GitHub Actions workflow, triggered on push to `main`, that runs the test/lint gate, builds (`npm run build`), and publishes `dist/` to GitHub Pages, so the app is reachable at `https://openkakutou.github.io/stage-viewer-web/`. See the roadmap's `.vibe/decisions/015` for the org-wide per-repo GitHub Pages convention this follows.

## Acceptance Criteria
- [ ] A workflow triggered on push to `main` runs `npm test` and `npm run lint` first; a failure stops the workflow before anything is published
- [ ] `npm run build`'s `dist/` output is published to GitHub Pages (via the repo's `gh-pages` branch or the native Pages deployment action)
- [ ] The deployed site loads without a console error caused by an incorrect asset base path (this repo's `vite.config.ts` already sets `base: "./"`, which should already work unmodified for a project-page URL — confirm rather than assume)
- [ ] GitHub Actions steps that touch repo/Pages permissions are pinned to a commit SHA (with a version comment), matching this org's existing CI convention (see `web-ui-kit`'s workflows)
- [ ] If a `wasm:download` script exists by the time this item is picked up (this repo's own item `001` is currently blocked on `stage` publishing a WASM release), add it as a build step before `npm run build`, mirroring `character-viewer-web`'s equivalent step; if not, the workflow still deploys whatever the app currently is (placeholder version text is a valid, working deploy — nothing here should wait for item 001 to finish)

## Notes
No hard dependency on other backlog items — this is infrastructure, not a feature. Deploying now, ahead of the WASM bridge landing, is deliberate: every later feature then lands live automatically on its own next merge.
