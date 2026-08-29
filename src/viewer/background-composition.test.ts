import { describe, expect, it } from "vitest";
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGAnimation, BGElement } from "../wasm/types.ts";
import {
  INITIAL_PLAYBACK_STATE,
  MAX_DELTA_MS,
  PLACEHOLDER_SIZE,
  TICK_RATE_HZ,
  advancePlayback,
  buildDrawPlan,
  classifyAnimationElements,
  collectSpriteRequests,
  computeSpriteTopLeft,
  resolveParallaxPosition,
  sortElementsForComposition,
  spriteRequestKey,
  stageXToCanvasX,
} from "./background-composition.ts";

function sprite(overrides: Partial<Sprite> = {}): Sprite {
  return {
    group: 0,
    image: 0,
    width: 40,
    height: 20,
    axisX: 0,
    axisY: 0,
    palette: 0,
    ...overrides,
  };
}

function element(overrides: Partial<BGElement> = {}): BGElement {
  return {
    name: "el",
    type: "normal",
    sprite: { group: 0, image: 0 },
    actionNumber: 0,
    layerNo: 0,
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    tileX: 0,
    tileY: 0,
    tileSpacingX: 0,
    tileSpacingY: 0,
    ...overrides,
  };
}

function animation(overrides: Partial<BGAnimation> = {}): BGAnimation {
  return {
    frames: [{ sprite: { group: 0, image: 0 }, time: 10 }],
    loopStart: 0,
    ...overrides,
  };
}

describe("resolveParallaxPosition", () => {
  it("returns the raw start position when the camera hasn't moved", () => {
    expect(resolveParallaxPosition(10, 20, 0.5, 0.8, 0, 0)).toEqual({
      x: 10,
      y: 20,
    });
  });

  it("offsets by camera movement scaled by each axis's own delta ratio", () => {
    expect(resolveParallaxPosition(10, 20, 0.5, 0.8, 100, 100)).toEqual({
      x: 10 + 100 * 0.5,
      y: 20 + 100 * 0.8,
    });
  });

  it("does not move at all when delta is zero on both axes", () => {
    expect(resolveParallaxPosition(10, 20, 0, 0, 500, 500)).toEqual({
      x: 10,
      y: 20,
    });
  });
});

describe("advancePlayback", () => {
  it("advances cameraX and elapsedTicksExact in proportion to real elapsed time, at the fixed tick rate", () => {
    const halfSecondMs = MAX_DELTA_MS / 2;

    const next = advancePlayback(INITIAL_PLAYBACK_STATE, halfSecondMs);

    expect(next.elapsedTicksExact).toBeCloseTo(
      (halfSecondMs / 1000) * TICK_RATE_HZ,
      5,
    );
  });

  it("produces the same end state for many small steps as for one large step covering the same total time", () => {
    const totalMs = MAX_DELTA_MS - 20;
    const manySmallSteps = Array.from(
      { length: 60 },
      () => totalMs / 60,
    ).reduce(
      (state, deltaMs) => advancePlayback(state, deltaMs),
      INITIAL_PLAYBACK_STATE,
    );
    const oneBigStep = advancePlayback(INITIAL_PLAYBACK_STATE, totalMs);

    expect(manySmallSteps.elapsedTicksExact).toBeCloseTo(
      oneBigStep.elapsedTicksExact,
      5,
    );
    expect(manySmallSteps.cameraX).toBeCloseTo(oneBigStep.cameraX, 5);
  });

  it("clamps an unusually large delta (e.g. a backgrounded tab resuming) to MAX_DELTA_MS instead of jumping ahead", () => {
    const hugeGapMs = MAX_DELTA_MS * 100;

    const next = advancePlayback(INITIAL_PLAYBACK_STATE, hugeGapMs);
    const clampedOnly = advancePlayback(INITIAL_PLAYBACK_STATE, MAX_DELTA_MS);

    expect(next.elapsedTicksExact).toBeCloseTo(
      clampedOnly.elapsedTicksExact,
      5,
    );
  });

  it("never advances backwards for a zero or negative delta", () => {
    const next = advancePlayback(INITIAL_PLAYBACK_STATE, 0);

    expect(next.elapsedTicksExact).toBe(
      INITIAL_PLAYBACK_STATE.elapsedTicksExact,
    );
    expect(next.cameraX).toBe(INITIAL_PLAYBACK_STATE.cameraX);
  });
});

describe("classifyAnimationElements", () => {
  it("classifies an anim element with no matching action-number block as no-animation", () => {
    const el = element({ type: "anim", actionNumber: 200 });

    const statuses = classifyAnimationElements(
      [el],
      null,
      new Map(),
      new Map(),
    );

    expect(statuses.get(0)).toEqual({ kind: "no-animation" });
  });

  it("classifies a blank-sentinel resolution as blank, not an error", () => {
    const el = element({ type: "anim", actionNumber: 200 });
    const animations = { "200": animation() };
    const resolved = new Map([[0, { group: -1, image: -1 }]]);

    const statuses = classifyAnimationElements(
      [el],
      animations,
      resolved,
      new Map(),
    );

    expect(statuses.get(0)).toEqual({ kind: "blank" });
  });

  it("classifies a resolved sprite absent from the sheet as unresolved-sprite", () => {
    const el = element({ type: "anim", actionNumber: 200 });
    const animations = { "200": animation() };
    const resolved = new Map([[0, { group: 9, image: 9 }]]);

    const statuses = classifyAnimationElements(
      [el],
      animations,
      resolved,
      new Map(),
    );

    expect(statuses.get(0)).toEqual({
      kind: "unresolved-sprite",
      sprite: { group: 9, image: 9 },
    });
  });

  it("classifies a resolved sprite present in the sheet as resolved", () => {
    const el = element({ type: "anim", actionNumber: 200 });
    const animations = { "200": animation() };
    const resolved = new Map([[0, { group: 0, image: 0 }]]);
    const meta = new Map([[spriteRequestKey(0, 0), sprite()]]);

    const statuses = classifyAnimationElements(
      [el],
      animations,
      resolved,
      meta,
    );

    expect(statuses.get(0)).toEqual({
      kind: "resolved",
      sprite: { group: 0, image: 0 },
    });
  });

  it("does not classify normal/parallax elements at all", () => {
    const el = element({ type: "normal" });

    const statuses = classifyAnimationElements(
      [el],
      null,
      new Map(),
      new Map(),
    );

    expect(statuses.has(0)).toBe(false);
  });
});

describe("stageXToCanvasX", () => {
  it("maps stage x=0 to the horizontal center of the local coordinate width", () => {
    expect(stageXToCanvasX(0, 320)).toBe(160);
  });

  it("maps a negative stage x to the left of center", () => {
    expect(stageXToCanvasX(-100, 320)).toBe(60);
  });

  it("maps a positive stage x to the right of center", () => {
    expect(stageXToCanvasX(100, 320)).toBe(260);
  });
});

describe("computeSpriteTopLeft", () => {
  it("offsets the configured position by the sprite's own axis so the axis lands exactly on it", () => {
    expect(computeSpriteTopLeft(100, 50, 25, 99)).toEqual({ x: 75, y: -49 });
  });

  it("is a no-op offset when the sprite has no axis (0,0)", () => {
    expect(computeSpriteTopLeft(10, 20, 0, 0)).toEqual({ x: 10, y: 20 });
  });
});

describe("sortElementsForComposition", () => {
  it("draws layer 0 (behind) before layer 1 (in front)", () => {
    const back = element({ name: "back", layerNo: 0 });
    const front = element({ name: "front", layerNo: 1 });

    const order = sortElementsForComposition([front, back]);

    expect(order.map((e) => e.name)).toEqual(["back", "front"]);
  });

  it("preserves original file order among elements sharing the same layer", () => {
    const a = element({ name: "a", layerNo: 0 });
    const b = element({ name: "b", layerNo: 0 });
    const c = element({ name: "c", layerNo: 0 });

    const order = sortElementsForComposition([c, a, b]);

    expect(order.map((e) => e.name)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      element({ name: "front", layerNo: 1 }),
      element({ name: "back", layerNo: 0 }),
    ];
    const originalOrder = input.map((e) => e.name);

    sortElementsForComposition(input);

    expect(input.map((e) => e.name)).toEqual(originalOrder);
  });
});

describe("spriteRequestKey", () => {
  it("produces the same key for the same group/image pair", () => {
    expect(spriteRequestKey(1, 2)).toBe(spriteRequestKey(1, 2));
  });

  it("produces distinct keys for distinct pairs, including a group/image swap", () => {
    expect(spriteRequestKey(1, 2)).not.toBe(spriteRequestKey(2, 1));
  });
});

describe("collectSpriteRequests", () => {
  it("collects one request per distinct sprite reference used by normal/parallax elements", () => {
    const elements = [
      element({ type: "normal", sprite: { group: 0, image: 0 } }),
      element({ type: "parallax", sprite: { group: 1, image: 3 } }),
    ];

    const requests = collectSpriteRequests(elements);

    expect(requests).toEqual(
      expect.arrayContaining([
        [0, 0],
        [1, 3],
      ]),
    );
    expect(requests).toHaveLength(2);
  });

  it("deduplicates the same sprite reference shared by multiple elements", () => {
    const elements = [
      element({ sprite: { group: 0, image: 0 } }),
      element({ sprite: { group: 0, image: 0 } }),
    ];

    expect(collectSpriteRequests(elements)).toEqual([[0, 0]]);
  });

  it("excludes an anim element's own static sprite field, which is unused for that type", () => {
    const elements = [
      element({
        type: "anim",
        actionNumber: 5,
        sprite: { group: 0, image: 0 },
      }),
    ];

    expect(collectSpriteRequests(elements)).toEqual([]);
  });

  it("includes every distinct sprite referenced by an anim element's matching animation frames", () => {
    const elements = [element({ type: "anim", actionNumber: 200 })];
    const animations = {
      "200": animation({
        frames: [
          { sprite: { group: 0, image: 0 }, time: 10 },
          { sprite: { group: 0, image: 1 }, time: 5 },
        ],
      }),
    };

    const requests = collectSpriteRequests(elements, animations);

    expect(requests).toEqual(
      expect.arrayContaining([
        [0, 0],
        [0, 1],
      ]),
    );
    expect(requests).toHaveLength(2);
  });

  it("contributes no request for an anim element whose action number has no matching block", () => {
    const elements = [element({ type: "anim", actionNumber: 999 })];
    const animations = { "200": animation() };

    expect(collectSpriteRequests(elements, animations)).toEqual([]);
  });

  it("deduplicates a sprite shared between a static element and an animation frame", () => {
    const elements = [
      element({ type: "normal", sprite: { group: 0, image: 0 } }),
      element({ type: "anim", actionNumber: 200 }),
    ];
    const animations = {
      "200": animation({
        frames: [{ sprite: { group: 0, image: 0 }, time: 10 }],
      }),
    };

    expect(collectSpriteRequests(elements, animations)).toEqual([[0, 0]]);
  });
});

describe("buildDrawPlan", () => {
  const localCoordWidth = 320;

  it("places a resolved sprite's top-left offset by its own axis, mapped to canvas X", () => {
    const el = element({
      startX: 10,
      startY: 20,
      sprite: { group: 0, image: 0 },
    });
    const meta = new Map([
      [
        spriteRequestKey(0, 0),
        sprite({ axisX: 5, axisY: 5, width: 40, height: 20 }),
      ],
    ]);
    const pixels = new Map([
      [
        spriteRequestKey(0, 0),
        { pixels: new Uint8Array(40 * 20 * 4), width: 40, height: 20 },
      ],
    ]);

    const plan = buildDrawPlan([el], meta, pixels, localCoordWidth);

    expect(plan).toEqual([
      {
        kind: "sprite",
        elementIndex: 0,
        x: stageXToCanvasX(10 - 5, localCoordWidth),
        y: 20 - 5,
        width: 40,
        height: 20,
        pixels: pixels.get(spriteRequestKey(0, 0))?.pixels,
      },
    ]);
  });

  it("orders commands back-to-front by layer, preserving file order within a layer", () => {
    const front = element({
      name: "front",
      layerNo: 1,
      sprite: { group: 0, image: 0 },
    });
    const back = element({
      name: "back",
      layerNo: 0,
      sprite: { group: 1, image: 0 },
    });
    const meta = new Map([
      [spriteRequestKey(0, 0), sprite()],
      [spriteRequestKey(1, 0), sprite()],
    ]);
    const pixels = new Map([
      [
        spriteRequestKey(0, 0),
        { pixels: new Uint8Array(1), width: 40, height: 20 },
      ],
      [
        spriteRequestKey(1, 0),
        { pixels: new Uint8Array(1), width: 40, height: 20 },
      ],
    ]);

    const plan = buildDrawPlan([front, back], meta, pixels, localCoordWidth);

    // back (layer 0, elementIndex 1) drawn before front (layer 1, elementIndex 0).
    expect(plan.map((c) => c.elementIndex)).toEqual([1, 0]);
  });

  it("draws a fixed-size placeholder, centered on the raw position, for a reference absent from the sheet", () => {
    const el = element({
      startX: 100,
      startY: 50,
      sprite: { group: 9, image: 9 },
    });

    const plan = buildDrawPlan([el], new Map(), new Map(), localCoordWidth);

    expect(plan).toEqual([
      {
        kind: "placeholder",
        elementIndex: 0,
        x: stageXToCanvasX(100, localCoordWidth) - PLACEHOLDER_SIZE / 2,
        y: 50 - PLACEHOLDER_SIZE / 2,
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
      },
    ]);
  });

  it("draws a placeholder sized/positioned from real metadata when pixels failed to resolve despite a valid reference", () => {
    const el = element({
      startX: 0,
      startY: 0,
      sprite: { group: 0, image: 0 },
    });
    const meta = new Map([
      [
        spriteRequestKey(0, 0),
        sprite({ axisX: 10, axisY: 10, width: 40, height: 20 }),
      ],
    ]);

    const plan = buildDrawPlan([el], meta, new Map(), localCoordWidth);

    expect(plan).toEqual([
      {
        kind: "placeholder",
        elementIndex: 0,
        x: stageXToCanvasX(-10, localCoordWidth),
        y: -10,
        width: 40,
        height: 20,
      },
    ]);
  });

  it("draws a fixed placeholder for an anim element with no animation status provided (no matching block)", () => {
    const el = element({
      type: "anim",
      actionNumber: 5,
      startX: 100,
      startY: 50,
    });

    const plan = buildDrawPlan([el], new Map(), new Map(), localCoordWidth);

    expect(plan).toEqual([
      {
        kind: "placeholder",
        elementIndex: 0,
        x: stageXToCanvasX(100, localCoordWidth) - PLACEHOLDER_SIZE / 2,
        y: 50 - PLACEHOLDER_SIZE / 2,
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
      },
    ]);
  });

  it("draws nothing at all for an anim element currently resolved to the blank sentinel — not an error", () => {
    const el = element({ type: "anim", actionNumber: 5 });
    const statuses = new Map<number, { kind: "blank" }>([
      [0, { kind: "blank" }],
    ]);

    const plan = buildDrawPlan(
      [el],
      new Map(),
      new Map(),
      localCoordWidth,
      { x: 0, y: 0 },
      statuses,
    );

    expect(plan).toEqual([]);
  });

  it("draws the resolved sprite for an anim element whose current frame resolves within the sheet", () => {
    const el = element({
      type: "anim",
      actionNumber: 5,
      startX: 10,
      startY: 20,
    });
    const meta = new Map([
      [
        spriteRequestKey(3, 1),
        sprite({ axisX: 5, axisY: 5, width: 40, height: 20 }),
      ],
    ]);
    const pixels = new Map([
      [
        spriteRequestKey(3, 1),
        { pixels: new Uint8Array(40 * 20 * 4), width: 40, height: 20 },
      ],
    ]);
    const statuses = new Map([
      [0, { kind: "resolved" as const, sprite: { group: 3, image: 1 } }],
    ]);

    const plan = buildDrawPlan(
      [el],
      meta,
      pixels,
      localCoordWidth,
      { x: 0, y: 0 },
      statuses,
    );

    expect(plan).toEqual([
      {
        kind: "sprite",
        elementIndex: 0,
        x: stageXToCanvasX(10 - 5, localCoordWidth),
        y: 20 - 5,
        width: 40,
        height: 20,
        pixels: pixels.get(spriteRequestKey(3, 1))?.pixels,
      },
    ]);
  });

  it("draws a placeholder for an anim element whose resolved sprite is absent from the sheet", () => {
    const el = element({
      type: "anim",
      actionNumber: 5,
      startX: 100,
      startY: 50,
    });
    const statuses = new Map([
      [
        0,
        { kind: "unresolved-sprite" as const, sprite: { group: 9, image: 9 } },
      ],
    ]);

    const plan = buildDrawPlan(
      [el],
      new Map(),
      new Map(),
      localCoordWidth,
      { x: 0, y: 0 },
      statuses,
    );

    expect(plan).toEqual([
      {
        kind: "placeholder",
        elementIndex: 0,
        x: stageXToCanvasX(100, localCoordWidth) - PLACEHOLDER_SIZE / 2,
        y: 50 - PLACEHOLDER_SIZE / 2,
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
      },
    ]);
  });

  it("offsets a normal/parallax element's position by the simulated camera, scaled by its own delta", () => {
    const el = element({
      startX: 10,
      startY: 20,
      deltaX: 0.5,
      deltaY: 0.8,
      sprite: { group: 0, image: 0 },
    });
    const meta = new Map([
      [spriteRequestKey(0, 0), sprite({ axisX: 0, axisY: 0 })],
    ]);
    const pixels = new Map([
      [
        spriteRequestKey(0, 0),
        { pixels: new Uint8Array(1), width: 40, height: 20 },
      ],
    ]);

    const plan = buildDrawPlan([el], meta, pixels, localCoordWidth, {
      x: 100,
      y: 100,
    });

    expect(plan[0]).toMatchObject({
      x: stageXToCanvasX(10 + 100 * 0.5, localCoordWidth),
      y: 20 + 100 * 0.8,
    });
  });

  it("does not move an element at all when the camera hasn't moved (default)", () => {
    const el = element({
      startX: 10,
      startY: 20,
      sprite: { group: 0, image: 0 },
    });
    const meta = new Map([
      [spriteRequestKey(0, 0), sprite({ axisX: 0, axisY: 0 })],
    ]);
    const pixels = new Map([
      [
        spriteRequestKey(0, 0),
        { pixels: new Uint8Array(1), width: 40, height: 20 },
      ],
    ]);

    const plan = buildDrawPlan([el], meta, pixels, localCoordWidth);

    expect(plan[0]).toMatchObject({
      x: stageXToCanvasX(10, localCoordWidth),
      y: 20,
    });
  });
});
