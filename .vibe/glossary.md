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
