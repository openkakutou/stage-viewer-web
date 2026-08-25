---
status: done
---
# Adopt `web-ui-kit` + WASM Bridge

## Description
This repo has no UI yet beyond a placeholder (`src/main.ts` just writes a version string) — the ideal moment to adopt the org's shared design system (`web-ui-kit`: layout shell, form/input components, canvas/viewport controls, design tokens) before building any real screen, rather than retrofitting it later, mirroring `character-viewer-web`'s own adoption of the kit (see the roadmap's `.vibe/decisions/011`). Alongside it, add `src/wasm/`, the bridge between this app and the `stage` WASM module: load `wasm_exec.js` and instantiate `public/wasm/stage.wasm` client-side, then expose a typed TypeScript wrapper around the module's stage-loading export, mirroring `character-viewer-web`'s `src/wasm/bridge.ts` pattern (load, call bindings, adapt the JSON contract to typed TS interfaces, return a typed result instead of throwing).

## Acceptance Criteria
- [ ] `web-ui-kit` added as a dependency, its layout shell used as this app's root frame
- [ ] Design tokens (color/spacing/typography) applied instead of any ad-hoc CSS
- [ ] The WASM module loads and instantiates successfully in a browser/jsdom test environment
- [ ] Calling the bridge with valid stage `.def` bytes returns a typed stage data object matching the `stage` library's JSON shape
- [ ] Calling the bridge with malformed or missing input returns a typed error result instead of throwing

## Notes
Cross-repo blocker: this item is blocked on `stage`'s own WASM entrypoint item, `006-wasm-entrypoint-and-release-pipeline.md` in the `stage` repo, being released — no `stage.wasm` build exists to bridge to until then. The `web-ui-kit` half of this item has no such blocker: the design system's layout shell/tokens are already published.
