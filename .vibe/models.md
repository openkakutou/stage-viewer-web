# Data models

## StageData
The full stage graph returned by `loadStage`. Mirrors the `stage` Go library's JSON contract exactly (`OpenKakutouStage.load`).

| Field | Type | Notes |
|---|---|---|
| bgDef | BGdef | Stage-level settings |
| elements | BGElement[] \| null | `null` (not `[]`) when the stage has no BG elements — a nil Go slice marshals to JSON `null` |
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

## StageResult
Discriminated-union result of `loadStage`: exactly one of `stage`/`error` is ever meaningful.

| Variant | Fields |
|---|---|
| success | `ok: true`, `stage: StageData` |
| failure | `ok: false`, `error: string` |
Defined in: `src/wasm/types.ts`
