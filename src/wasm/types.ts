// Typed mirror of the JSON contract published by the `stage` WASM module
// (`OpenKakutouStage.load`). Field names and shapes match the Go-side
// `json:"..."` tags exactly — see `stage`'s docs/data-model.md and
// docs/wasm.md. These are pure data types: no parsing/decoding logic lives
// here, mirroring `character-viewer-web`'s own `src/wasm/types.ts` shape.

/** A BG element's rendering behavior (`.def` BG element `type` key). */
export type BGElementType = "normal" | "parallax" | "anim";

/** A sprite reference within the stage's sprite sheet (`.def` `spriteno`). */
export interface SpriteRef {
  group: number;
  image: number;
}

/** Stage-level settings (`[BGDef]`, `[StageInfo]`, `[Camera]` sections). */
export interface BGdef {
  spriteFile: string;
  localCoordWidth: number;
  localCoordHeight: number;
  zOffset: number;
  zoomOut: number;
  zoomIn: number;
  /** Path to a 3D model file — Ikemen GO extension, empty for a 2D stage. */
  modelFile: string;
  near: number;
  far: number;
  fov: number;
  yShift: number;
}

/** A single `[BG element_name]` section — one layer of the stage's background. */
export interface BGElement {
  name: string;
  type: BGElementType;
  /** Static sprite reference, used by "normal"/"parallax", zero-value for "anim". */
  sprite: SpriteRef;
  /** `.air` action number this element plays, used only by "anim". */
  actionNumber: number;
  /** Draw order relative to characters: 0 behind, 1 in front. */
  layerNo: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  tileX: number;
  tileY: number;
  tileSpacingX: number;
  tileSpacingY: number;
}

/** The box the camera's own position is clamped to (`[Camera]` bounds). */
export interface CameraBounds {
  left: number;
  right: number;
  high: number;
  low: number;
}

/**
 * Where characters may move (`[PlayerInfo]` bounds): x-axis always, plus a
 * z-axis (depth) extension for a model-based stage.
 */
export interface StageBoundaries {
  left: number;
  right: number;
  topBound: number;
  bottomBound: number;
}

/** 3D model placement and lighting (`[Model]` section, Ikemen GO extension). */
export interface Model {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  environment: string;
  environmentIntensity: number;
}

/**
 * 3D perspective scaling (`[Scaling]` section, Ikemen GO extension): how a
 * character's on-screen size/vertical offset changes with depth (Z).
 */
export interface Scaling {
  depthToScreen: number;
  topZ: number;
  bottomZ: number;
  topScale: number;
  bottomScale: number;
}

/** Each player's starting depth (Z) position (Ikemen GO extension). */
export interface PlayerStartZ {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
  p7: number;
  p8: number;
}

/** The full stage graph returned by `OpenKakutouStage.load`. */
export interface StageData {
  /** `[Info]` `name` — empty string when the stage's `.def` doesn't set it. */
  name: string;
  /** `[Info]` `author` — empty string when the stage's `.def` doesn't set it. */
  author: string;
  bgDef: BGdef;
  /**
   * `null` (not `[]`) when the stage has no BG elements — mirrors `stage`'s
   * own zero-value `Elements` being a nil slice, which Go's `encoding/json`
   * marshals as `null` rather than an empty array (see `stage`'s
   * `docs/data-model.md`, "A zero-value `Stage` is valid").
   */
  elements: BGElement[] | null;
  cameraBounds: CameraBounds;
  stageBoundaries: StageBoundaries;
  model: Model;
  scaling: Scaling;
  playerStartZ: PlayerStartZ;
}

/**
 * Result of the typed bridge wrapper: exactly one of `stage`/`error` is
 * ever meaningful, mirroring the WASM module's own `{stage, error}`
 * contract one level up in TypeScript, as a discriminated union instead of
 * a thrown exception.
 */
export type StageResult =
  | { ok: true; stage: StageData }
  | { ok: false; error: string };
