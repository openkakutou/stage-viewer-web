import { describe, expect, it } from "vitest";
import type { Sprite } from "../wasm/sff-types.ts";
import type { BGElement } from "../wasm/types.ts";
import {
  PLACEHOLDER_SIZE,
  buildDrawPlan,
  collectSpriteRequests,
  computeSpriteTopLeft,
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

  it("excludes anim elements, which have no static sprite reference to resolve", () => {
    const elements = [
      element({
        type: "anim",
        actionNumber: 5,
        sprite: { group: 0, image: 0 },
      }),
    ];

    expect(collectSpriteRequests(elements)).toEqual([]);
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

  it("produces no command at all for an anim element — not drawn, not a placeholder", () => {
    const el = element({ type: "anim", actionNumber: 5 });

    const plan = buildDrawPlan([el], new Map(), new Map(), localCoordWidth);

    expect(plan).toEqual([]);
  });
});
