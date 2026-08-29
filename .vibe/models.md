# Data models

## StageData
The full stage graph returned by `loadStage`. Mirrors the `stage` Go library's JSON contract exactly (`OpenKakutouStage.load`).

| Field | Type | Notes |
|---|---|---|
| name | string | `[Info]` `name` — empty string when the stage's `.def` doesn't set it |
| author | string | `[Info]` `author` — empty string when the stage's `.def` doesn't set it |
| bgDef | BGdef | Stage-level settings |
| elements | BGElement[] \| null | `null` (not `[]`) when the stage has no BG elements — a nil Go slice marshals to JSON `null` |
| animations | Record\<string, BGAnimation\> \| null | Every parsed `[Begin Action N]` block, keyed by action number as a string (Go's `map[int]BGAnimation` marshals int keys as JSON string keys); `null` when the stage defines none |
| cameraBounds | CameraBounds | The box the camera's own position is clamped to |
| stageBoundaries | StageBoundaries | Where characters may move |
| model | Model | 3D model placement/lighting (Ikemen GO extension) |
| scaling | Scaling | 3D perspective scaling (Ikemen GO extension) |
| playerStartZ | PlayerStartZ | Each player's starting depth (Z) position (Ikemen GO extension) |
Defined in: `src/wasm/types.ts`

## BGdef
| Field | Type | Notes |
|---|---|---|
| spriteFile | string | Path to the stage's `.sff` sprite sheet |
| localCoordWidth, localCoordHeight | number | Coordinate space element positions are expressed in |
| zOffset | number | Ground level's vertical distance from the top of the local coordinate space |
| zoomOut, zoomIn | number | Camera's zoom scale range |
| modelFile | string | Path to a 3D model file — Ikemen GO extension, empty for a 2D stage |
| near, far, fov, yShift | number | 3D-only camera settings |
Defined in: `src/wasm/types.ts`

## BGElement
One `[BG element_name]` section — one layer of the stage's background.

| Field | Type | Notes |
|---|---|---|
| name | string | The element's section name |
| type | BGElementType | `"normal"` (static sprite), `"parallax"` (depth-scrolling), or `"anim"` (`.air`-driven) |
| sprite | SpriteRef | Static sprite reference — used by `"normal"`/`"parallax"`, zero-value for `"anim"` |
| actionNumber | number | `.air` action number this element plays — used only by `"anim"` |
| layerNo | number | Draw order relative to characters: 0 behind, 1 in front |
| startX, startY | number | Starting position, in local coordinate units |
| deltaX, deltaY | number | Scroll ratio applied per unit of camera movement (parallax depth) |
| tileX, tileY | number | Tiling repetition per axis |
| tileSpacingX, tileSpacingY | number | Pixel gap between repeated tiles |
Defined in: `src/wasm/types.ts`

## SpriteRef
| Field | Type | Notes |
|---|---|---|
| group | number | Sprite sheet group index |
| image | number | Sprite index within the group |
Defined in: `src/wasm/types.ts`

## BGAnimFrame
One displayed frame within a `BGAnimation`.

| Field | Type | Notes |
|---|---|---|
| sprite | SpriteRef | Which sprite to show while this frame is active |
| time | number | How many ticks to hold this frame before advancing |
Defined in: `src/wasm/types.ts`

## BGAnimation
One `[Begin Action N]` block — an animated BG element's frame sequence.

| Field | Type | Notes |
|---|---|---|
| frames | BGAnimFrame[] | Ordered frame sequence |
| loopStart | number | Index `frames` loops back to once played through once |
Defined in: `src/wasm/types.ts`

## AnimationFrameRequest
One request to `resolveAnimationFrames`.

| Field | Type | Notes |
|---|---|---|
| animation | BGAnimation \| null | `null` (no matching block, or none requested) resolves to the blank sentinel |
| elapsedTicks | number | How far into playback this element currently is |
Defined in: `src/wasm/bridge.ts`

## ResolveAnimationFramesResult
Discriminated-union result of `resolveAnimationFrames`: exactly one of `sprites`/`error` is ever meaningful.

| Variant | Fields |
|---|---|
| success | `ok: true`, `sprites: SpriteRef[]` |
| failure | `ok: false`, `error: string` |
Defined in: `src/wasm/bridge.ts`

## PlaybackState
The animated background preview's playback clock — real-time-based, not tied to how many frames were actually rendered.

| Field | Type | Notes |
|---|---|---|
| elapsedTicksExact | number | Total elapsed ticks since playback started, as a real number — floored only when sent to `resolveAnimationFrames` |
| cameraX | number | The simulated camera's current horizontal position |
Defined in: `src/viewer/background-composition.ts`

## AnimationFrameStatus
Which sprite an `"anim"` BG element should currently show, classified for both drawing and row-label purposes.

| Variant | Fields |
|---|---|
| no-animation | (none) — the element's action number has no matching `BGAnimation` block |
| blank | (none) — `stage`'s own "nothing to draw this frame" sentinel; not an error |
| unresolved-sprite | `sprite: SpriteRef` — resolved, but absent from the sprite sheet |
| resolved | `sprite: SpriteRef` — resolved and present in the sheet |
Defined in: `src/viewer/background-composition.ts`

## CameraBounds
| Field | Type | Notes |
|---|---|---|
| left, right, high, low | number | The camera's own scroll position clamp |
Defined in: `src/wasm/types.ts`

## StageBoundaries
| Field | Type | Notes |
|---|---|---|
| left, right | number | X-axis movement clamp |
| topBound, bottomBound | number | Z-axis (depth) movement clamp — model-based stages only |
Defined in: `src/wasm/types.ts`

## Model
3D model placement and lighting (Ikemen GO extension).

| Field | Type | Notes |
|---|---|---|
| offsetX, offsetY, offsetZ | number | The model's placement origin in the 3D scene |
| scaleX, scaleY, scaleZ | number | The model's scale on each axis |
| environment | string | Path to an `.hdr` file used for image-based lighting |
| environmentIntensity | number | How strongly `environment`'s lighting affects the model |
Defined in: `src/wasm/types.ts`

## Scaling
3D perspective scaling (Ikemen GO extension): how a character's on-screen size and vertical offset change with depth (Z) position.

| Field | Type | Notes |
|---|---|---|
| depthToScreen | number | How a player's Z position affects their Y offset on screen |
| topZ, bottomZ | number | The Z-space reference points `topScale`/`bottomScale` apply at |
| topScale, bottomScale | number | The on-screen scale factors at `topZ`/`bottomZ`, interpolated in between |
Defined in: `src/wasm/types.ts`

## PlayerStartZ
Each player's starting depth (Z) position (Ikemen GO extension).

| Field | Type | Notes |
|---|---|---|
| p1..p8 | number | Starting Z position for players 1 through 8 |
Defined in: `src/wasm/types.ts`

## Sprite
One sprite's metadata within a sprite sheet — position, size, palette reference. Never pixel data — that's `resolveSpritePixels`'s own separate `pixels` field.

| Field | Type | Notes |
|---|---|---|
| group, image | number | Identify the sprite, same shape as `SpriteRef` |
| width, height | number | Sprite dimensions in pixels |
| axisX, axisY | number | The sprite's own drawing origin (pivot) offset |
| palette | number | Which palette (of the sheet's shared palettes) this sprite uses |
Defined in: `src/wasm/sff-types.ts`

## SpriteGroup
All sprites sharing the same group index, as `sff` groups them.

| Field | Type | Notes |
|---|---|---|
| index | number | The group's own index |
| sprites | Sprite[] | Every sprite in this group |
Defined in: `src/wasm/sff-types.ts`

## SpriteSheetResult
Discriminated-union result of `loadSpriteSheet`: exactly one of `spriteGroups`/`error` is ever meaningful.

| Variant | Fields |
|---|---|
| success | `ok: true`, `spriteGroups: SpriteGroup[]` |
| failure | `ok: false`, `error: string` |
Defined in: `src/wasm/sff-bridge.ts`

## SpritePixelResult
One decoded sprite's actual pixels, from `resolveSpritePixels` — one per request, in order, independently `ok`/error so one absent sprite in a batch doesn't fail the rest.

| Variant | Fields |
|---|---|
| success | `ok: true`, `pixels: Uint8Array`, `width: number`, `height: number` |
| failure | `ok: false`, `error: string` |
Defined in: `src/wasm/sff-bridge.ts`

## DrawCommand
One instruction in a background preview's draw plan — either a decoded sprite or a placeholder tile, at a canvas position.

| Variant | Fields |
|---|---|
| sprite | `elementIndex`, `x`, `y`, `width`, `height`, `pixels: Uint8Array` |
| placeholder | `elementIndex`, `x`, `y`, `width`, `height` |
Defined in: `src/viewer/background-composition.ts`

## StageResult
Discriminated-union result of `loadStage`: exactly one of `stage`/`error` is ever meaningful.

| Variant | Fields |
|---|---|
| success | `ok: true`, `stage: StageData` |
| failure | `ok: false`, `error: string` |
Defined in: `src/wasm/types.ts`

## GatheredFile
A file gathered from a folder selection or drag-and-drop, plus its path relative to the folder the user picked.

| Field | Type | Notes |
|---|---|---|
| file | File | The native browser File object |
| relativePath | string | Path within the picked folder (from `webkitRelativePath`, or a `FileSystemEntry.fullPath` walk for drag-and-drop) |
Defined in: `src/input/folder-entries.ts`

## CandidateResolution
What to do with the files gathered from a folder selection, regarding which one is the stage's `.def`.

| Variant | Fields |
|---|---|
| no-files | (none) — nothing was gathered at all |
| no-candidate | (none) — nothing matched the `.def` heuristic |
| success | `entry: GatheredFile` — exactly one candidate, auto-resolved |
| needs-selection | `candidates: GatheredFile[]` — several candidates, caller must ask |
Defined in: `src/input/stage-file-input.ts`

## SpriteSheetResolution
The outcome of resolving a stage's referenced sprite sheet against a gathered folder listing, by basename (exact match first, case-insensitive fallback second).

| Variant | Fields |
|---|---|
| no-reference | (none) — the stage's `.def` has no sprite sheet key at all |
| success | `entry: GatheredFile` |
| not-found | `referencedName: string` — the exact string the `.def` referenced |
| ambiguous | `referencedName: string`, `candidates: GatheredFile[]` — more than one file shares the resolved name |
Defined in: `src/input/stage-file-input.ts`

## StageFolderInputResult
The end-to-end result of loading a stage from a folder: candidate resolution passthrough, plus the stage-load and sprite-sheet-resolution outcomes.

| Variant | Fields |
|---|---|
| success | `fileName`, `relativePath`, `stage: StageData`, `defBytes`, `sffFileName`, `sffRelativePath`, `sffBytes` |
| no-files / no-candidate | (none) |
| needs-selection | `candidates: GatheredFile[]` |
| read-error / parse-error | `fileName: string`, `message: string` |
| sprite-not-found | `fileName: string`, `referencedName: string` |
| sprite-ambiguous | `fileName: string`, `referencedName: string`, `candidates: GatheredFile[]` |
| sprite-read-error | `fileName: string`, `sffFileName: string`, `message: string` |
Defined in: `src/input/stage-file-input.ts`
