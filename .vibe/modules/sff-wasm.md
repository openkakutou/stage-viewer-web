# Module: sff-wasm
**Role:** A second, independent bridge to the `sff` WebAssembly module (not `stage`'s own) — loads it client-side and exposes typed `loadSpriteSheet`/`resolveSpritePixels` wrappers, used by the background preview to decode sprite metadata (axis/size, for placement and reference validation) and actual pixel data.
**Files:** `src/wasm/sff-bridge.ts`, `src/wasm/sff-types.ts`
**Exports:** `loadSpriteSheet(sffBytes: Uint8Array, options?: SffWasmBridgeOptions): Promise<SpriteSheetResult>`, `resolveSpritePixels(sffBytes: Uint8Array, requests: [number, number][], overridePaletteBytes: Uint8Array | null, options?: SffWasmBridgeOptions): Promise<SpritePixelResult[]>`, `resetSffWasmBridgeForTests(): void`, `SffWasmBridgeOptions`, `SpriteSheetResult`, `SpritePixelResult`, `Sprite`, `SpriteGroup`
**Depends on:** (none — talks directly to the `sff.wasm`/its own `wasm_exec.js` globals fetched from `public/wasm/sff/`)
