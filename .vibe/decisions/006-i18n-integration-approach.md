---
date: 2026-09-07
status: accepted
---
# Localization (i18n) integration approach

**Context:** Backlog item 008 adopts the shared `web-ui-kit` i18next integration layer (`initI18n`, `t`, `<wuik-locale-switcher>`, roadmap decision `023`) so this app's UI strings move into `src/i18n/en.json`/`fr.json` and the user can switch language live, without a page reload, with the choice persisted across reloads. This exact feature already shipped in the sibling `lifebar-viewer-web` repo (its own backlog item 008); this decision adapts that shape to this app's specific screens.

**Decision:**
- The app's brand name ("Stage Viewer") is left untranslated, treated as a proper noun — only descriptive text, status/error messages, and accessible labels move into the catalogs. Raw stage data (an element's name, its `type` enum value, numeric coordinates) is never passed through translation either — only the surrounding UI copy is.
- A thin wrapper (`src/i18n/i18n.ts`) mirrors `web-ui-kit`'s own `t(key, defaultValue, vars?)` contract exactly, under this app's own namespace (`stage-viewer-web`) and its own `localStorage` key (`stage-viewer-web-locale`) — every OpenKakutou web app deploys as its own GitHub Pages project site under the same origin, so sharing `web-ui-kit`'s default key would leak one app's language choice into every other one. Every call site's `defaultValue` is kept identical, character for character, to the English catalog entry for that key, so a render produces the same text whether or not `initI18n` has run yet — the existing test suite keeps asserting plain English text unchanged without bootstrapping i18n itself.
- `initI18n` is only ever called from the real bootstrap (`mount()` in `main.ts`), awaited before the first `renderApp` call.
- Live locale-switching is handled differently per screen, matching how much state each one owns, rather than one uniform re-render:
  - The characteristics panel carries no state of its own — `main.ts`'s single top-level `onLocaleChange` subscription simply re-invokes `renderCharacteristicsPanel` from the currently loaded stage data.
  - The stage folder input (`stage-file-input-view.ts`) keeps its currently-displayed status/error text as a small unformatted `StatusDescriptor` (not a pre-formatted string) and subscribes to `onLocaleChange` internally, re-formatting that descriptor plus every static label/hint/button text in place — mirrors `lifebar-viewer-web`'s own folder-input view.
  - The background preview and 3D model preview own real live/async state (playback position, selection, a mounted three.js renderer) that a full re-render would destroy. Each instead collects small "re-translate this in place" closures as it builds its DOM (a badge, a status line, the play/pause button, every row's summary/status text, a failure banner's body) and fires them from one `onLocaleChange` subscription scoped to that render call — translated text updates live; canvas/renderer/playback state is untouched.
- Pluralized fragments aren't needed by this app's own catalog (no "N items" copy exists in the current UI); if one is added later, it should follow `lifebar-viewer-web`'s own precedent (a translated noun composed into a translated template, not i18next's automatic plural-key suffixing) for consistency across the org's apps.

**Reason:** Matching each screen's re-render strategy to how much state it owns is what keeps this feature from regressing the background/3D preview's own careful live-state handling (playback position, WebGL renderer, selection) while still keeping the existing, already-large test suite passing with minimal, surgical edits — the fallback-mirrors-default-value property is what makes that possible for the majority of existing tests.

**Rejected alternatives:**
- *Re-run `renderBackgroundPreview`/`renderModelPreview` wholesale on every locale change, same as the characteristics panel* — rejected: both own real async/live state (in-flight WASM sprite decode, playback timer, a mounted three.js renderer with its own WebGL context and pending frame) that a full re-render would tear down and restart, visibly resetting playback and re-fetching data the user already has on screen.
- *Sharing `web-ui-kit`'s default `wuik-locale` storage key* — rejected for the same reason `lifebar-viewer-web` rejected it: this org's shared GitHub Pages origin would leak one app's locale choice into every other OpenKakutou app on it.
