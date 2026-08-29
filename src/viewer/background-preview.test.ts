import { describe, expect, it, vi } from "vitest";
import type {
  SpritePixelResult,
  SpriteSheetResult,
} from "../wasm/sff-bridge.ts";
import type { BGAnimation, BGElement, StageData } from "../wasm/types.ts";
import { renderBackgroundPreview } from "./background-preview.ts";

function element(overrides: Partial<BGElement> = {}): BGElement {
  return {
    name: "sky",
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

function stageWith(
  elements: BGElement[] | null,
  animations: Record<string, BGAnimation> | null = null,
): StageData {
  return {
    name: "Training Room",
    author: "",
    bgDef: {
      spriteFile: "stage0.sff",
      localCoordWidth: 320,
      localCoordHeight: 240,
      zOffset: 0,
      zoomOut: 0,
      zoomIn: 0,
      modelFile: "",
      near: 0,
      far: 0,
      fov: 0,
      yShift: 0,
    },
    elements,
    animations,
    cameraBounds: { left: 0, right: 0, high: 0, low: 0 },
    stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
    model: {
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      scaleX: 0,
      scaleY: 0,
      scaleZ: 0,
      environment: "",
      environmentIntensity: 0,
    },
    scaling: {
      depthToScreen: 0,
      topZ: 0,
      bottomZ: 0,
      topScale: 0,
      bottomScale: 0,
    },
    playerStartZ: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0 },
  };
}

function stubLoadSpriteSheet(result: SpriteSheetResult) {
  return vi.fn().mockResolvedValue(result);
}

function stubResolveSpritePixels(results: SpritePixelResult[]) {
  return vi.fn().mockResolvedValue(results);
}

const oneValidSprite: SpriteSheetResult = {
  ok: true,
  spriteGroups: [
    {
      index: 0,
      sprites: [
        {
          group: 0,
          image: 0,
          width: 40,
          height: 20,
          axisX: 0,
          axisY: 0,
          palette: 0,
        },
      ],
    },
  ],
};

const onePixelResult: SpritePixelResult[] = [
  { ok: true, pixels: new Uint8Array(40 * 20 * 4), width: 40, height: 20 },
];

describe("renderBackgroundPreview", () => {
  it("renders nothing when no stage is loaded", () => {
    const root = document.createElement("div");
    root.textContent = "placeholder";

    renderBackgroundPreview(root, null, null, {});

    expect(root.textContent).toBe("");
  });

  it("shows an explicit empty state, not a blank canvas, for a stage with zero BG elements", () => {
    const root = document.createElement("div");

    renderBackgroundPreview(root, stageWith([]), new Uint8Array(), {});

    expect(root.querySelector(".background-preview__empty")).not.toBeNull();
    expect(root.querySelector("canvas")).toBeNull();
  });

  it("treats a null elements array the same as an empty one", () => {
    const root = document.createElement("div");

    renderBackgroundPreview(root, stageWith(null), new Uint8Array(), {});

    expect(root.querySelector(".background-preview__empty")).not.toBeNull();
  });

  it("lists every configured element with its key properties, once sprites resolve", async () => {
    const root = document.createElement("div");
    const stage = stageWith([
      element({ name: "sky", layerNo: 0, startX: 5, startY: 10 }),
      element({ name: "cloud", layerNo: 1, startX: -5, startY: 20 }),
    ]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });
    await vi.waitFor(() => {
      expect(root.querySelectorAll(".background-preview__row")).toHaveLength(2);
    });

    const rows = root.querySelectorAll(".background-preview__row");
    expect(rows[0]?.textContent).toContain("sky");
    expect(rows[0]?.textContent).toContain("5");
    expect(rows[1]?.textContent).toContain("cloud");
  });

  it("flags a row whose sprite reference is absent from the loaded sheet", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element({ sprite: { group: 9, image: 9 } })]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels([
        { ok: false, error: "not found" },
      ]),
    });
    await vi.waitFor(() => {
      expect(root.querySelector(".background-preview__row")).not.toBeNull();
    });

    expect(root.querySelector(".background-preview__row")?.textContent).toMatch(
      /invalid/i,
    );
  });

  it("degrades to showing the list (every reference unresolved) instead of hanging when the WASM module itself fails to start", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element()]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: vi.fn().mockRejectedValue(new Error("network error")),
      resolveSpritePixels: vi
        .fn()
        .mockRejectedValue(new Error("network error")),
    });

    await vi.waitFor(() => {
      expect(root.querySelector(".background-preview__row")).not.toBeNull();
    });
    expect(root.querySelector(".background-preview__status")).toBeNull();
    expect(root.querySelector(".background-preview__row")?.textContent).toMatch(
      /invalid/i,
    );
  });

  it("marks an anim element with no matching animation block distinctly, never as an invalid reference", async () => {
    const root = document.createElement("div");
    const stage = stageWith([
      element({ type: "anim", actionNumber: 5, name: "flash" }),
    ]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels([]),
    });
    await vi.waitFor(() => {
      expect(root.querySelector(".background-preview__row")).not.toBeNull();
    });

    const rowText =
      root.querySelector(".background-preview__row")?.textContent ?? "";
    expect(rowText).not.toMatch(/invalid/i);
    expect(rowText).toMatch(/no matching animation/i);
  });

  it("shows no status label for an anim element that has a matching animation block", async () => {
    const root = document.createElement("div");
    const stage = stageWith(
      [element({ type: "anim", actionNumber: 5, name: "flash" })],
      {
        "5": {
          frames: [{ sprite: { group: 0, image: 0 }, time: 10 }],
          loopStart: 0,
        },
      },
    );

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      resolveAnimationFrames: vi
        .fn()
        .mockResolvedValue({ ok: true, sprites: [{ group: 0, image: 0 }] }),
    });
    await vi.waitFor(() => {
      expect(root.querySelector(".background-preview__row")).not.toBeNull();
    });
    await vi.waitFor(() => {
      const rowText =
        root.querySelector(".background-preview__row")?.textContent ?? "";
      expect(rowText).not.toMatch(/no matching animation|invalid/i);
    });
  });

  describe("playback controls", () => {
    function fakeRaf() {
      let queued: FrameRequestCallback | null = null;
      const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
        queued = cb;
        return 1;
      });
      const cancelAnimationFrame = vi.fn(() => {
        queued = null;
      });
      return {
        requestAnimationFrame,
        cancelAnimationFrame,
        fire: (timestamp: number) => {
          const cb = queued;
          queued = null;
          cb?.(timestamp);
        },
        isQueued: () => queued !== null,
      };
    }

    function playButton(root: HTMLElement): HTMLElement {
      const button = Array.from(root.querySelectorAll("wuik-button")).find(
        (el) => el.textContent === "Play" || el.textContent === "Pause",
      );
      if (!button) throw new Error("play/pause button not found");
      return button as HTMLElement;
    }

    async function renderAnimatedStage(raf: ReturnType<typeof fakeRaf>) {
      const root = document.createElement("div");
      const stage = stageWith(
        [element({ type: "anim", actionNumber: 5, name: "flash" })],
        {
          "5": {
            frames: [{ sprite: { group: 0, image: 0 }, time: 10 }],
            loopStart: 0,
          },
        },
      );
      const resolveAnimationFrames = vi
        .fn()
        .mockResolvedValue({ ok: true, sprites: [{ group: 0, image: 0 }] });
      const drawComposition = vi.fn();

      renderBackgroundPreview(root, stage, new Uint8Array(), {
        loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
        resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
        resolveAnimationFrames,
        drawComposition,
        requestAnimationFrame: raf.requestAnimationFrame,
        cancelAnimationFrame: raf.cancelAnimationFrame,
      });
      await vi.waitFor(() => {
        expect(root.querySelector(".background-preview__row")).not.toBeNull();
      });

      return { root, resolveAnimationFrames, drawComposition };
    }

    it("starts paused, with a Play control that switches to Pause once clicked", async () => {
      const raf = fakeRaf();
      const { root } = await renderAnimatedStage(raf);

      expect(playButton(root).textContent).toBe("Play");
      playButton(root).click();
      expect(playButton(root).textContent).toBe("Pause");
    });

    it("issues one batched resolveAnimationFrames call per tick while playing", async () => {
      const raf = fakeRaf();
      const { root, resolveAnimationFrames } = await renderAnimatedStage(raf);
      resolveAnimationFrames.mockClear();

      playButton(root).click();
      raf.fire(16);
      await vi.waitFor(() => {
        expect(resolveAnimationFrames).toHaveBeenCalledTimes(1);
      });
    });

    it("stops issuing ticks once paused", async () => {
      const raf = fakeRaf();
      const { root, resolveAnimationFrames } = await renderAnimatedStage(raf);
      resolveAnimationFrames.mockClear();

      playButton(root).click();
      raf.fire(16);
      await vi.waitFor(() => {
        expect(resolveAnimationFrames).toHaveBeenCalledTimes(1);
      });
      playButton(root).click(); // pause
      expect(raf.isQueued()).toBe(false);

      resolveAnimationFrames.mockClear();
      raf.fire(32); // no-op: nothing was queued after pause
      expect(resolveAnimationFrames).not.toHaveBeenCalled();
    });

    it("resumes from the same elapsed position instead of resetting to zero", async () => {
      const raf = fakeRaf();
      const { root, resolveAnimationFrames } = await renderAnimatedStage(raf);
      resolveAnimationFrames.mockClear();

      playButton(root).click();
      raf.fire(16);
      await vi.waitFor(() =>
        expect(resolveAnimationFrames).toHaveBeenCalledTimes(1),
      );
      const firstElapsedTicks = resolveAnimationFrames.mock.calls[0]?.[0]?.[0]
        ?.elapsedTicks as number;

      playButton(root).click(); // pause
      playButton(root).click(); // resume
      resolveAnimationFrames.mockClear();
      raf.fire(16); // first tick after resuming has no prior timestamp, so its own delta is 0 —
      // elapsedTicks must still reflect everything accumulated before the pause, never reset to 0.
      await vi.waitFor(() => {
        expect(resolveAnimationFrames).toHaveBeenCalledTimes(1);
      });
      const resumedElapsedTicks = resolveAnimationFrames.mock.calls[0]?.[0]?.[0]
        ?.elapsedTicks as number;

      expect(resumedElapsedTicks).toBeGreaterThanOrEqual(firstElapsedTicks);
    });

    it("cancels a previous playback loop when the render function is called again on the same root", async () => {
      const raf = fakeRaf();
      const { root, resolveAnimationFrames } = await renderAnimatedStage(raf);
      playButton(root).click();
      expect(raf.isQueued()).toBe(true);

      renderBackgroundPreview(root, stageWith([]), new Uint8Array(), {
        requestAnimationFrame: raf.requestAnimationFrame,
        cancelAnimationFrame: raf.cancelAnimationFrame,
      });

      expect(raf.cancelAnimationFrame).toHaveBeenCalled();
      expect(raf.isQueued()).toBe(false);
      resolveAnimationFrames.mockClear();
      raf.fire(16);
      expect(resolveAnimationFrames).not.toHaveBeenCalled();
    });
  });

  it("sizes the canvas to the stage's own local coordinate space", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element()]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLCanvasElement>("canvas")?.hidden).toBe(
        false,
      );
    });

    const canvas = root.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas?.width).toBe(320);
    expect(canvas?.height).toBe(240);
  });

  it("selecting a row draws the composition again with that element highlighted", async () => {
    const root = document.createElement("div");
    const stage = stageWith([
      element({ name: "sky" }),
      element({ name: "cloud" }),
    ]);
    const drawComposition = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels([
        onePixelResult[0],
        onePixelResult[0],
      ] as SpritePixelResult[]),
      drawComposition,
    });
    await vi.waitFor(() => {
      expect(root.querySelectorAll(".background-preview__row")).toHaveLength(2);
    });
    drawComposition.mockClear();

    const rows = root.querySelectorAll<HTMLElement>(".background-preview__row");
    rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(drawComposition).toHaveBeenCalledTimes(1);
    const call = drawComposition.mock.calls[0];
    expect(call?.[2]).toBe(1); // selectedElementIndex
    expect(rows[1]?.getAttribute("aria-current")).toBe("true");
    expect(rows[0]?.hasAttribute("aria-current")).toBe(false);
  });
});
