// Pure, three.js-free helpers for the 3D model preview (backlog item 006):
// deriving a usable camera projection and model transform from a loaded
// stage's already-parsed fields, with fallbacks for a degenerate value a
// real-world `.def` might declare. Kept dependency-free so this logic is
// unit-testable on its own, mirroring background-composition.ts's own
// "pure math in its own module, DOM/rendering orchestration on top" split
// (.vibe/decisions/003).
import type { BGdef, Model } from "../wasm/types.ts";

const DEFAULT_FOV = 45;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 10000;

export interface CameraParams {
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}

/**
 * Resolves the 3D camera's field-of-view/near/far planes from the stage's
 * own declared `[Camera]` fields, falling back to sane defaults when the
 * stage declares a degenerate value (a 2D-only stage's `.def` never sets
 * these, and MUGEN/Ikemen's own `[Camera]` section predates the 3D
 * extension, so `0`/negative is a real, expected input here, not a
 * malformed one).
 */
export function resolveCameraParams(bgDef: BGdef): CameraParams {
  return {
    fov: bgDef.fov > 0 ? bgDef.fov : DEFAULT_FOV,
    near: bgDef.near > 0 ? bgDef.near : DEFAULT_NEAR,
    far:
      bgDef.far > (bgDef.near > 0 ? bgDef.near : DEFAULT_NEAR)
        ? bgDef.far
        : DEFAULT_FAR,
  };
}

export interface ModelTransform {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
}

/** Resolves the model's placement/scale from the stage's `[Model]` data. */
export function resolveModelTransform(model: Model): ModelTransform {
  return {
    position: [model.offsetX, model.offsetY, model.offsetZ],
    scale: [model.scaleX, model.scaleY, model.scaleZ],
  };
}
