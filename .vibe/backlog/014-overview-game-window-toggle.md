---
status: todo
depends_on: [013]
---
# Add an Overview / Game-Window View Toggle

## Description
Item 013 makes the background preview always render in "overview" sizing (the stage's full real content extent). This item adds an explicit two-way toggle so the user can switch to a "game window" mode that reproduces exactly the original, unchanged rendering — the `localCoordWidth × localCoordHeight` window a player would actually see in-game — for cases where that fixed framing (rather than the full-content overview) is what's wanted, e.g. to check the exact in-game crop, or during a 3D stage's Play/pan.

- Location: promote the existing `<div class="background-preview__controls">` (already holding the Play/Pause button) to a `<wuik-toolbar>`, grouping Play/Pause with the new control.
- Control: `<wuik-radio-group>` with two `<wuik-radio-option value="overview">`/`value="game-window">` options — a named two-state exclusive choice, not an anonymous boolean toggle (the component already exists in `web-ui-kit`).
- State: closure-scoped `let viewMode: "overview" | "game-window" = "overview"` (same convention as this file's existing `isPlaying`/`selectedElementIndex`), listening for the `wuik-change` event → recompute canvas size/`aspect-ratio` per mode (item 013's overview path vs. the original fixed `localCoordWidth × localCoordHeight` path with no translation) → rebuild/redraw → `resetViewportToFit(viewport)`.
- Play interaction: no special-casing needed in the tick/playback loop — `buildDrawPlan(..., {x: playbackState.cameraX, y: 0}, ...)` is called identically in both modes; only the canvas dimensions and whether `translateDrawCommands` is applied (`bbox` offset vs. `{0,0}`) differ per mode.
- 3D stages (`hasModelLayer === true`): keep the toggle disabled/hidden and force `"game-window"` mode, per item 013's scope note.
- New i18n keys (`src/i18n/en.json`/`fr.json`, `background.*` namespace, same structure as the existing `background.play`/`background.pause`): `background.viewModeLabel`, `background.viewModeOverview`, `background.viewModeGameWindow`.

## Acceptance Criteria
- [ ] The toggle is visible in the background preview's controls (as a `<wuik-radio-group>` with "overview"/"game window" options) whenever the stage is not 3D, and hidden/disabled for a 3D (`hasModelLayer`) stage.
- [ ] Switching to "overview" shows the full stage content per item 013; switching to "game window" reproduces exactly today's original fixed `localCoordWidth × localCoordHeight` rendering, confirmed pixel-equivalent in a real-browser check.
- [ ] Toggling mode while Play is active keeps playback (parallax pan) working correctly in both modes, with no visual jump or broken state.
- [ ] Both new labels render through the existing i18n system (`en.json`/`fr.json`), matching the app's existing key-naming convention for this file.

## Notes
Requires item 013 (overview-mode canvas sizing) to exist first, since this item's "game window" branch is defined as "the same sizing item 013 introduced, but with the pre-013 fixed-window values instead."
