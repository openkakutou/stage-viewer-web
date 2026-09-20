# Ubiquitous Language

## Stage
A MUGEN/Ikemen GO background: its sprite sheet, coordinate space, camera settings, BG elements/layers, and (for a model-based stage) 3D model/scaling/player-depth settings. Read from a `.def` file via the `stage` WASM module; this app is read-only, so a `Stage` is only ever loaded here, never edited or saved.
_Sources: `src/wasm/types.ts`, `src/wasm/bridge.ts`_

## BG Element
A single layer of a stage's background — a static sprite, a depth-scrolling (parallax) layer, or an `.air`-animated layer. Each has a draw order relative to characters (in front or behind), a starting position, and tiling settings.
_Sources: `src/wasm/types.ts`_

## Parallax
A BG Element's scrolling behavior that simulates depth: it scrolls at a different ratio than the camera's own movement, so elements at different depths appear to move at different speeds. Every BG Element carries this ratio (`deltaX`/`deltaY`), not only ones typed `"parallax"` — a `"normal"` element's ratio is simply `0` in practice.
**Do not confuse with:** BG Element, which parallax is one behavior (`type`) of.
_Sources: `src/wasm/types.ts`, `src/viewer/background-composition.ts`_

## Animation Block
An `.air`-syntax `[Begin Action N]` section a stage's `.def` defines: the ordered frame sequence (which sprite, how long to hold it) an `"anim"`-typed BG Element plays, keyed by the action number that element references. A BG Element referencing an action number with no matching block is a data error, distinct from the block resolving to no sprite on a given tick, which is a normal, empty-but-valid state.
**Do not confuse with:** BG Element, which references an Animation Block by number rather than embedding one.
_Sources: `src/wasm/types.ts`, `src/viewer/background-composition.ts`_

## Camera Bounds
The box a stage's camera can scroll within — its own left/right/high/low limits, distinct from where characters themselves may move (see Stage Boundaries).
**Do not confuse with:** Stage Boundaries.
_Sources: `src/wasm/types.ts`_

## Stage Boundaries
Where characters may move within a stage: an x-axis range always, plus a z-axis (depth) range for a model-based stage. Distinct from Camera Bounds, which clamps the camera's own position instead.
**Do not confuse with:** Camera Bounds.
_Sources: `src/wasm/types.ts`_

## Sprite Sheet
The image file (`.sff`) a stage references for the sprites its BG Elements draw from. A stage's own `.def` only ever stores a path *reference* to its sprite sheet — the actual file is a separate one, resolved from the same folder the `.def` came from.
_Sources: `src/wasm/types.ts`, `src/input/stage-file-input.ts`_

## 3D Model-Based Stage
A Stage that references a 3D model file (an Ikemen GO extension) instead of, or alongside, its flat BG Elements — signaled by `bgDef.modelFile` being non-empty, the same field this app's own characteristics panel reads to state whether a loaded stage is 2D or 3D. Such a stage also carries model placement/scale, environment (image-based) lighting, and 3D-only camera settings, all zero-valued unless a model is actually referenced.
**Do not confuse with:** BG Element, which a 3D Model-Based Stage may still define alongside its model — the two compose in the same preview rather than being mutually exclusive.
_Sources: `src/wasm/types.ts`, `src/viewer/characteristics-panel.ts`, `src/input/model-assets.ts`, `src/viewer/model-preview.ts`_

## Overview Mode
How a 2D-only Stage's composed background preview is sized by default: the canvas covers the stage's real content extent — every BG Element plus the declared Camera Bounds and Stage Boundaries — rather than being clipped to the stage's own fixed `localCoordWidth`/`localCoordHeight` window, so the whole Stage is visible and reachable through zoom/pan. A Stage whose content already fits entirely within that window renders identically either way. A 3D Model-Based Stage is excluded and always keeps the fixed window instead. A 2D Stage can be switched to Game Window Mode instead via an explicit toggle.
**Do not confuse with:** Camera Bounds/Stage Boundaries, which are two of the several inputs unioned to compute this mode's canvas extent, not the mode itself. Game Window Mode, this mode's opposite.
_Sources: `src/viewer/background-bounds.ts`, `src/viewer/background-preview.ts`_

## Game Window Mode
The composed background preview's other sizing choice, selectable via an explicit toggle next to Play/Pause: the canvas is sized to exactly the Stage's own fixed declared `localCoordWidth`/`localCoordHeight` window, with no content-extent expansion — reproducing the exact crop a player actually sees in-game, byte-for-byte the same rendering this app used before Overview Mode existed. A 3D Model-Based Stage always renders this way, with no toggle shown, since its `stack` container also hosts an independent 3D viewport with no bounding-box concept to switch between.
**Do not confuse with:** Overview Mode, this mode's opposite and the default for a 2D Stage.
_Sources: `src/viewer/background-preview.ts`_
