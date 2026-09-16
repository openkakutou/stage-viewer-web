import { describe, expect, it } from "vitest";
import type { CameraBounds, StageBoundaries } from "../wasm/types.ts";
import {
  computeStageBoundingBox,
  translateDrawCommands,
} from "./background-bounds.ts";
import type { DrawCommand } from "./background-composition.ts";

const LOCAL_COORD_WIDTH = 320;
const LOCAL_COORD_HEIGHT = 240;

function cameraBounds(overrides: Partial<CameraBounds> = {}): CameraBounds {
  return { left: -160, right: 160, high: 0, low: 240, ...overrides };
}

function stageBoundaries(
  overrides: Partial<StageBoundaries> = {},
): StageBoundaries {
  return {
    left: -160,
    right: 160,
    topBound: 0,
    bottomBound: 240,
    ...overrides,
  };
}

function placeholderCommand(
  overrides: Partial<Extract<DrawCommand, { kind: "placeholder" }>> = {},
): DrawCommand {
  return {
    kind: "placeholder",
    elementIndex: 0,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...overrides,
  };
}

describe("computeStageBoundingBox", () => {
  it("returns exactly the declared local coordinate window when nothing exceeds it (regression parity)", () => {
    const commands: DrawCommand[] = [
      placeholderCommand({ x: 10, y: 10, width: 20, height: 20 }),
    ];

    const box = computeStageBoundingBox(
      commands,
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box).toEqual({
      minX: 0,
      maxX: LOCAL_COORD_WIDTH,
      minY: 0,
      maxY: LOCAL_COORD_HEIGHT,
    });
  });

  it("returns exactly the declared window with no draw commands at all", () => {
    const box = computeStageBoundingBox(
      [],
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box).toEqual({
      minX: 0,
      maxX: LOCAL_COORD_WIDTH,
      minY: 0,
      maxY: LOCAL_COORD_HEIGHT,
    });
  });

  it("expands minX/maxX when a draw command falls outside the window horizontally", () => {
    const commands: DrawCommand[] = [
      placeholderCommand({ x: -50, y: 10, width: 20, height: 20 }),
      placeholderCommand({ x: 400, y: 10, width: 30, height: 20 }),
    ];

    const box = computeStageBoundingBox(
      commands,
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box.minX).toBe(-50);
    expect(box.maxX).toBe(430);
    expect(box.minY).toBe(0);
    expect(box.maxY).toBe(LOCAL_COORD_HEIGHT);
  });

  it("expands minY/maxY when a draw command falls outside the window vertically", () => {
    const commands: DrawCommand[] = [
      placeholderCommand({ x: 10, y: -40, width: 20, height: 20 }),
      placeholderCommand({ x: 10, y: 300, width: 20, height: 25 }),
    ];

    const box = computeStageBoundingBox(
      commands,
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box.minX).toBe(0);
    expect(box.maxX).toBe(LOCAL_COORD_WIDTH);
    expect(box.minY).toBe(-40);
    expect(box.maxY).toBe(325);
  });

  it("expands the box when cameraBounds falls outside the window", () => {
    const box = computeStageBoundingBox(
      [],
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds({ left: -300, right: 300, high: -50, low: 500 }),
      stageBoundaries(),
    );

    // stageXToCanvasX(-300, 320) = 160 - 300 = -140
    // stageXToCanvasX(300, 320) = 160 + 300 = 460
    expect(box.minX).toBe(-140);
    expect(box.maxX).toBe(460);
    expect(box.minY).toBe(-50);
    expect(box.maxY).toBe(500);
  });

  it("expands the box when stageBoundaries falls outside the window", () => {
    const box = computeStageBoundingBox(
      [],
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries({
        left: -400,
        right: 400,
        topBound: -100,
        bottomBound: 600,
      }),
    );

    // stageXToCanvasX(-400, 320) = 160 - 400 = -240
    // stageXToCanvasX(400, 320) = 160 + 400 = 560
    expect(box.minX).toBe(-240);
    expect(box.maxX).toBe(560);
    expect(box.minY).toBe(-100);
    expect(box.maxY).toBe(600);
  });

  it("does not produce an inverted/degenerate box when cameraBounds/stageBoundaries are out of nominal order", () => {
    const box = computeStageBoundingBox(
      [],
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      // high < low, right < left — reversed from the nominal ordering
      cameraBounds({ left: 200, right: -200, high: 500, low: -50 }),
      stageBoundaries({
        left: 300,
        right: -300,
        topBound: 700,
        bottomBound: -100,
      }),
    );

    expect(box.minX).toBeLessThanOrEqual(box.maxX);
    expect(box.minY).toBeLessThanOrEqual(box.maxY);
    // stageXToCanvasX(-300, 320) = -140, stageXToCanvasX(300, 320) = 460
    expect(box.minX).toBe(-140);
    expect(box.maxX).toBe(460);
    expect(box.minY).toBe(-100);
    expect(box.maxY).toBe(700);
  });

  it("rounds the box outward to integers (floor on min, ceil on max)", () => {
    const commands: DrawCommand[] = [
      placeholderCommand({ x: -10.2, y: -5.1, width: 3.4, height: 2.9 }),
    ];

    const box = computeStageBoundingBox(
      commands,
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box.minX).toBe(-11);
    expect(box.minY).toBe(-6);
    expect(Number.isInteger(box.minX)).toBe(true);
    expect(Number.isInteger(box.maxX)).toBe(true);
    expect(Number.isInteger(box.minY)).toBe(true);
    expect(Number.isInteger(box.maxY)).toBe(true);
  });

  it("unions a sprite draw command's own box the same way as a placeholder", () => {
    const commands: DrawCommand[] = [
      {
        kind: "sprite",
        elementIndex: 0,
        x: 500,
        y: -80,
        width: 40,
        height: 30,
        pixelWidth: 40,
        pixelHeight: 30,
        pixels: new Uint8Array(0),
      },
    ];

    const box = computeStageBoundingBox(
      commands,
      LOCAL_COORD_WIDTH,
      LOCAL_COORD_HEIGHT,
      cameraBounds(),
      stageBoundaries(),
    );

    expect(box.maxX).toBe(540);
    expect(box.minY).toBe(-80);
  });
});

describe("translateDrawCommands", () => {
  it("shifts every command's x/y by -dx/-dy, preserving all other fields", () => {
    const commands: DrawCommand[] = [
      placeholderCommand({
        elementIndex: 2,
        x: 10,
        y: 20,
        width: 5,
        height: 6,
      }),
    ];

    const translated = translateDrawCommands(commands, 4, 7);

    expect(translated).toEqual([
      {
        kind: "placeholder",
        elementIndex: 2,
        x: 6,
        y: 13,
        width: 5,
        height: 6,
      },
    ]);
  });

  it("returns a new array, leaving the input untouched", () => {
    const commands: DrawCommand[] = [placeholderCommand({ x: 10, y: 20 })];

    const translated = translateDrawCommands(commands, 4, 7);

    expect(translated).not.toBe(commands);
    expect(commands[0]).toEqual(placeholderCommand({ x: 10, y: 20 }));
  });

  it("preserves sprite-kind fields (pixels, width/height, pixelWidth/pixelHeight) while translating", () => {
    const pixels = new Uint8Array([1, 2, 3]);
    const commands: DrawCommand[] = [
      {
        kind: "sprite",
        elementIndex: 1,
        x: 10,
        y: 20,
        width: 40,
        height: 30,
        pixelWidth: 40,
        pixelHeight: 30,
        pixels,
      },
    ];

    const translated = translateDrawCommands(commands, 3, 5);

    expect(translated).toEqual([
      {
        kind: "sprite",
        elementIndex: 1,
        x: 7,
        y: 15,
        width: 40,
        height: 30,
        pixelWidth: 40,
        pixelHeight: 30,
        pixels,
      },
    ]);
  });

  it("handles an empty command list without error", () => {
    expect(translateDrawCommands([], 1, 1)).toEqual([]);
  });
});
