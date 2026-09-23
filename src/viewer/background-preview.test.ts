import { describe, expect, it, vi } from "vitest";
import { initAppI18n } from "../i18n/i18n.ts";
import type { ModelAssetsResolution } from "../input/model-assets.ts";
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
      xScale: 1,
      yScale: 1,
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

  it("re-translates the play button and row summary text in place on a live locale change, without resetting playback state", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element({ name: "sky" })]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });
    await vi.waitFor(() => {
      expect(root.querySelectorAll(".background-preview__row")).toHaveLength(1);
    });

    const playButton = root.querySelector<HTMLElement>("wuik-button");
    expect(playButton?.textContent).toBe("Play");

    const instance = await initAppI18n();
    await instance.changeLanguage("fr");

    expect(playButton?.textContent).toBe("Lecture");
    expect(
      root.querySelector(".background-preview__row-main")?.textContent,
    ).toBe("sky · normal · calque 0 · (0, 0)");

    await instance.changeLanguage("en");
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

  it("shows a spinner alongside the decoding-sprites status, removed once decoding finishes", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element()]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });

    const status = root.querySelector(".background-preview__status");
    expect(status).not.toBeNull();
    expect(status?.querySelector("wuik-spinner")).not.toBeNull();

    await vi.waitFor(() => {
      expect(root.querySelector(".background-preview__row")).not.toBeNull();
    });
    expect(root.querySelector(".background-preview__status")).toBeNull();
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

describe("renderBackgroundPreview — 3D model layer (backlog item 006)", () => {
  const noModel: ModelAssetsResolution = { status: "none" };
  const successModel: ModelAssetsResolution = {
    status: "success",
    modelBytes: new Uint8Array([1]),
    modelFileName: "mystage.glb",
    environmentBytes: null,
    environmentFileName: null,
  };
  const failedModel: ModelAssetsResolution = {
    status: "model-not-found",
    referencedName: "mystage.glb",
  };

  it("never invokes the 3D renderer, and draws with hasModelLayer=false, for a stage with no [Model] data", async () => {
    const root = document.createElement("div");
    const drawComposition = vi.fn();
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(
      root,
      stageWith([element({ name: "sky" })]),
      new Uint8Array(),
      {
        loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
        resolveSpritePixels: stubResolveSpritePixels([
          onePixelResult[0],
        ] as SpritePixelResult[]),
        drawComposition,
        renderModelPreview,
        modelAssets: noModel,
      },
    );
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    expect(renderModelPreview).not.toHaveBeenCalled();
    expect(root.querySelector(".background-preview__mode-badge")).toBeNull();
    const call = drawComposition.mock.calls[0];
    expect(call?.[3]).toBe(false); // hasModelLayer
  });

  it("mounts the 3D renderer into its own layer and shows the mode badge for a successfully-resolved model", async () => {
    const root = document.createElement("div");
    const drawComposition = vi.fn();
    const renderModelPreview = vi.fn();
    const stage = stageWith([element({ name: "sky" })]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels([
        onePixelResult[0],
      ] as SpritePixelResult[]),
      drawComposition,
      renderModelPreview,
      modelAssets: successModel,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    expect(renderModelPreview).toHaveBeenCalledTimes(1);
    const [layerRoot, passedStage, passedAssets] =
      renderModelPreview.mock.calls[0];
    expect(layerRoot).toBeInstanceOf(HTMLElement);
    expect((layerRoot as HTMLElement).className).toBe(
      "background-preview__model-layer",
    );
    expect(passedStage).toBe(stage);
    expect(passedAssets).toBe(successModel);
    expect(
      root.querySelector(".background-preview__mode-badge"),
    ).not.toBeNull();
    const call = drawComposition.mock.calls[0];
    expect(call?.[3]).toBe(true); // hasModelLayer
  });

  it("still mounts the 3D renderer (which shows its own failure banner) and the mode badge when asset resolution failed", async () => {
    const root = document.createElement("div");
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(
      root,
      stageWith([element({ name: "sky" })]),
      new Uint8Array(),
      {
        loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
        resolveSpritePixels: stubResolveSpritePixels([
          onePixelResult[0],
        ] as SpritePixelResult[]),
        renderModelPreview,
        modelAssets: failedModel,
      },
    );
    await vi.waitFor(() => {
      expect(renderModelPreview).toHaveBeenCalled();
    });

    expect(renderModelPreview.mock.calls[0]?.[2]).toBe(failedModel);
    expect(
      root.querySelector(".background-preview__mode-badge"),
    ).not.toBeNull();
  });

  it("still renders the 3D layer for a stage with a model but zero 2D BG elements", () => {
    const root = document.createElement("div");
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(root, stageWith([]), new Uint8Array(), {
      renderModelPreview,
      modelAssets: successModel,
    });

    expect(renderModelPreview).toHaveBeenCalledTimes(1);
    expect(
      root.querySelector(".background-preview__model-layer"),
    ).not.toBeNull();
  });

  it("shows the plain empty state, with no 3D layer, for a stage with neither 2D elements nor model data", () => {
    const root = document.createElement("div");
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(root, stageWith([]), new Uint8Array(), {
      renderModelPreview,
      modelAssets: noModel,
    });

    expect(renderModelPreview).not.toHaveBeenCalled();
    expect(root.querySelector(".background-preview__empty")).not.toBeNull();
  });
});

describe("renderBackgroundPreview — overview-mode canvas sizing (backlog item 013)", () => {
  function stageWithBounds(
    elements: BGElement[],
    overrides: Partial<
      Pick<StageData, "cameraBounds" | "stageBoundaries">
    > = {},
  ): StageData {
    return { ...stageWith(elements), ...overrides };
  }

  function findPlayButton(root: HTMLElement): HTMLElement {
    const button = Array.from(root.querySelectorAll("wuik-button")).find(
      (el) => el.textContent === "Play" || el.textContent === "Pause",
    );
    if (!button) throw new Error("play/pause button not found");
    return button as HTMLElement;
  }

  it("expands the canvas beyond the local coordinate window when an element is positioned past it", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);

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
    const stack = root.querySelector<HTMLElement>(".background-preview__stack");
    expect(canvas?.width).toBeGreaterThan(320);
    expect(canvas?.height).toBeGreaterThanOrEqual(1000);
    expect(stack?.style.aspectRatio).toBe(
      `${canvas?.width} / ${canvas?.height}`,
    );
  });

  it("expands the canvas to cover declared camera bounds / stage boundaries even when every element fits inside the window", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element()], {
      cameraBounds: { left: -2000, right: 2000, high: -50, low: 50 },
      stageBoundaries: {
        left: -2000,
        right: 2000,
        topBound: 0,
        bottomBound: 0,
      },
    });

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
    // The declared range alone (-2000..2000) is far wider than localCoordWidth
    // (320) could ever cover — any correct wiring must grow well past it.
    expect(canvas?.width).toBeGreaterThan(3500);
  });

  it("never produces an inverted or negative-size canvas when cameraBounds/stageBoundaries fields are given out of natural order", async () => {
    const root = document.createElement("div");
    // left > right, high > low — a real `stage` data quirk this app never
    // assumes ordered (see background-bounds.ts's own docs).
    const stage = stageWithBounds([element()], {
      cameraBounds: { left: 500, right: -500, high: 300, low: -300 },
      stageBoundaries: {
        left: 800,
        right: -800,
        topBound: 0,
        bottomBound: 0,
      },
    });

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
    expect(canvas?.width).toBeGreaterThan(0);
    expect(canvas?.height).toBeGreaterThan(0);
    // Still widened to cover the (unioned) declared range, not collapsed by
    // the out-of-order fields.
    expect(canvas?.width).toBeGreaterThan(320);
  });

  it("keeps a 3D model-based stage at the fixed local coordinate window even when its 2D elements are positioned far past it", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 5000, startY: 5000 })]);
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      renderModelPreview,
      modelAssets: {
        status: "success",
        modelBytes: new Uint8Array([1]),
        modelFileName: "stage.glb",
        environmentBytes: null,
        environmentFileName: null,
      },
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

  it("re-fits the viewport once on load, but not again on a playback tick whose visible extent is unchanged", async () => {
    const root = document.createElement("div");
    // deltaX 0 (the default): this element's canvas position never moves
    // with cameraX, so its (already oversized) extent is stable tick to tick.
    const stage = stageWithBounds([element({ startX: 1000 })]);
    const drawComposition = vi.fn();
    let queued: FrameRequestCallback | null = null;
    const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      queued = cb;
      return 1;
    });
    const cancelAnimationFrame = vi.fn(() => {
      queued = null;
    });
    const fire = (timestamp: number) => {
      const cb = queued;
      queued = null;
      cb?.(timestamp);
    };

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      drawComposition,
      requestAnimationFrame,
      cancelAnimationFrame,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    const viewport = root.querySelector("wuik-viewport") as HTMLElement & {
      resetToFit?: () => void;
    };
    const resetToFit = vi.fn();
    viewport.resetToFit = resetToFit;

    findPlayButton(root).click();
    drawComposition.mockClear();
    fire(0); // establishes lastFrameTimestamp; its own delta is 0 (no cameraX movement yet)
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalledTimes(1);
    });
    drawComposition.mockClear();
    fire(80); // a real elapsed delta now — cameraX advances, but this element ignores it
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalledTimes(1);
    });

    expect(resetToFit).not.toHaveBeenCalled();
  });

  it("re-fits the viewport again once a playback tick genuinely grows the visible extent past what was previously shown", async () => {
    const root = document.createElement("div");
    // deltaX 50: a large parallax ratio so a single tick's cameraX
    // advancement pushes this element's canvas position far past the
    // window, growing the bbox mid-playback (not just on load).
    const stage = stageWithBounds([
      element({ startX: 0, startY: 0, deltaX: 50 }),
    ]);
    const drawComposition = vi.fn();
    let queued: FrameRequestCallback | null = null;
    const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      queued = cb;
      return 1;
    });
    const cancelAnimationFrame = vi.fn(() => {
      queued = null;
    });
    const fire = (timestamp: number) => {
      const cb = queued;
      queued = null;
      cb?.(timestamp);
    };

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      drawComposition,
      requestAnimationFrame,
      cancelAnimationFrame,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    const viewport = root.querySelector("wuik-viewport") as HTMLElement & {
      resetToFit?: () => void;
    };
    const resetToFit = vi.fn();
    viewport.resetToFit = resetToFit;

    findPlayButton(root).click();
    drawComposition.mockClear();
    fire(0); // establishes lastFrameTimestamp; no cameraX movement yet
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalledTimes(1);
    });
    expect(resetToFit).not.toHaveBeenCalled();

    drawComposition.mockClear();
    fire(80); // real elapsed delta — cameraX advances, pushing the element well past the window
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalledTimes(1);
    });

    expect(resetToFit).toHaveBeenCalledTimes(1);
  });
});

describe("renderBackgroundPreview — missing localcoord fallback (backlog item 016)", () => {
  function stageWithMissingLocalcoord(elements: BGElement[] | null): StageData {
    const stage = stageWith(elements);
    return {
      ...stage,
      bgDef: { ...stage.bgDef, localCoordWidth: 0, localCoordHeight: 0 },
    };
  }

  it("renders the composed background at MUGEN/Ikemen's 320x240 default instead of collapsing to a 0x0 canvas", async () => {
    const root = document.createElement("div");
    const stage = stageWithMissingLocalcoord([element()]);

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
    const stack = root.querySelector<HTMLElement>(".background-preview__stack");
    expect(canvas?.width).toBe(320);
    expect(canvas?.height).toBe(240);
    expect(stack?.style.aspectRatio).toBe("320 / 240");
  });

  it("still renders a model-based stage's stack at 320x240 (not 0x0) when its own [StageInfo] also omits localcoord", () => {
    const root = document.createElement("div");
    const stage = stageWithMissingLocalcoord(null);
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      renderModelPreview,
      modelAssets: {
        status: "success",
        modelBytes: new Uint8Array([1]),
        modelFileName: "stage.glb",
        environmentBytes: null,
        environmentFileName: null,
      },
    });

    const stack = root.querySelector<HTMLElement>(".background-preview__stack");
    expect(stack?.style.aspectRatio).toBe("320 / 240");
  });

  it("continues to render with an explicitly declared, non-default localcoord unchanged", async () => {
    const root = document.createElement("div");
    const stage = stageWith([element()]);
    stage.bgDef.localCoordWidth = 640;
    stage.bgDef.localCoordHeight = 480;

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
    expect(canvas?.width).toBe(640);
    expect(canvas?.height).toBe(480);
  });
});

describe("renderBackgroundPreview — overview/game-window view toggle (backlog item 014)", () => {
  function stageWithBounds(
    elements: BGElement[],
    overrides: Partial<
      Pick<StageData, "cameraBounds" | "stageBoundaries">
    > = {},
  ): StageData {
    return { ...stageWith(elements), ...overrides };
  }

  function findPlayButton(root: HTMLElement): HTMLElement {
    const button = Array.from(root.querySelectorAll("wuik-button")).find(
      (el) => el.textContent === "Play" || el.textContent === "Pause",
    );
    if (!button) throw new Error("play/pause button not found");
    return button as HTMLElement;
  }

  function findViewModeGroup(root: HTMLElement): HTMLElement {
    const group = root.querySelector("wuik-radio-group");
    if (!group) throw new Error("view mode radio group not found");
    return group as HTMLElement;
  }

  function changeViewMode(group: HTMLElement, value: string): void {
    group.setAttribute("value", value);
    group.dispatchEvent(
      new CustomEvent("wuik-change", { detail: { value }, bubbles: true }),
    );
  }

  it("shows the overview/game-window toggle, defaulting to overview, for a 2D stage", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLCanvasElement>("canvas")?.hidden).toBe(
        false,
      );
    });

    const group = findViewModeGroup(root);
    expect(group.getAttribute("value")).toBe("overview");
    const options = Array.from(
      root.querySelectorAll("wuik-radio-option"),
    ) as HTMLElement[];
    expect(options.map((o) => o.getAttribute("value"))).toEqual([
      "overview",
      "game-window",
    ]);
  });

  it("does not render the toggle for a 3D (hasModelLayer) stage, always using the fixed window", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 5000, startY: 5000 })]);
    const renderModelPreview = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      renderModelPreview,
      modelAssets: {
        status: "success",
        modelBytes: new Uint8Array([1]),
        modelFileName: "stage.glb",
        environmentBytes: null,
        environmentFileName: null,
      },
    });
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLCanvasElement>("canvas")?.hidden).toBe(
        false,
      );
    });

    expect(root.querySelector("wuik-radio-group")).toBeNull();
    const canvas = root.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas?.width).toBe(320);
    expect(canvas?.height).toBe(240);
  });

  it("switching to game-window mode resizes the canvas to the fixed local coordinate window with no translation", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);
    const drawComposition = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      drawComposition,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    const canvas = root.querySelector<HTMLCanvasElement>("canvas");
    // Overview mode: expanded well past the fixed 320x240 window.
    expect(canvas?.width).toBeGreaterThan(320);

    const group = findViewModeGroup(root);
    drawComposition.mockClear();
    changeViewMode(group, "game-window");

    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });
    expect(canvas?.width).toBe(320);
    expect(canvas?.height).toBe(240);

    // No bounding-box translation: the plan drawn in game-window mode places
    // the element at exactly the position buildDrawPlan alone would have
    // produced (stageXToCanvasX(1000, 320) = 160 + 1000 on X, untouched on
    // Y), not shifted by a bbox origin the way overview mode would.
    const call = drawComposition.mock.calls[0];
    const plan = call?.[1] as { x: number; y: number }[];
    expect(plan[0]?.x).toBe(1160);
    expect(plan[0]?.y).toBe(1000);
  });

  it("switching back to overview mode re-expands the canvas to the content bounding box", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);
    const drawComposition = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      drawComposition,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    const group = findViewModeGroup(root);
    changeViewMode(group, "game-window");
    await vi.waitFor(() => {
      const canvas = root.querySelector<HTMLCanvasElement>("canvas");
      expect(canvas?.width).toBe(320);
    });

    changeViewMode(group, "overview");
    await vi.waitFor(() => {
      const canvas = root.querySelector<HTMLCanvasElement>("canvas");
      expect(canvas?.width).toBeGreaterThan(320);
    });
  });

  it("re-dispatching the same already-active mode is a no-op (no extra redraw)", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);
    const drawComposition = vi.fn();

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      drawComposition,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    const group = findViewModeGroup(root);
    drawComposition.mockClear();
    changeViewMode(group, "overview"); // already active
    expect(drawComposition).not.toHaveBeenCalled();
  });

  it("toggling mode while playing keeps playback running with no error, in both directions", async () => {
    const root = document.createElement("div");
    const stage = stageWith(
      [element({ type: "anim", actionNumber: 5, startX: 1000 })],
      {
        "5": {
          frames: [{ sprite: { group: 0, image: 0 }, time: 10 }],
          loopStart: 0,
        },
      },
    );
    const drawComposition = vi.fn();
    let queued: FrameRequestCallback | null = null;
    const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      queued = cb;
      return 1;
    });
    const cancelAnimationFrame = vi.fn(() => {
      queued = null;
    });
    const fire = (timestamp: number) => {
      const cb = queued;
      queued = null;
      cb?.(timestamp);
    };
    const resolveAnimationFrames = vi
      .fn()
      .mockResolvedValue({ ok: true, sprites: [{ group: 0, image: 0 }] });

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
      resolveAnimationFrames,
      drawComposition,
      requestAnimationFrame,
      cancelAnimationFrame,
    });
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    findPlayButton(root).click();
    const group = findViewModeGroup(root);
    changeViewMode(group, "game-window");

    drawComposition.mockClear();
    fire(16);
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    changeViewMode(group, "overview");
    drawComposition.mockClear();
    fire(32);
    await vi.waitFor(() => {
      expect(drawComposition).toHaveBeenCalled();
    });

    expect(findPlayButton(root).textContent).toBe("Pause");
  });

  it("re-translates the view mode toggle's labels in place on a live locale change", async () => {
    const root = document.createElement("div");
    const stage = stageWithBounds([element({ startX: 1000, startY: 1000 })]);

    renderBackgroundPreview(root, stage, new Uint8Array(), {
      loadSpriteSheet: stubLoadSpriteSheet(oneValidSprite),
      resolveSpritePixels: stubResolveSpritePixels(onePixelResult),
    });
    await vi.waitFor(() => {
      expect(root.querySelector("wuik-radio-group")).not.toBeNull();
    });

    const options = Array.from(
      root.querySelectorAll("wuik-radio-option"),
    ) as HTMLElement[];
    expect(options[0]?.textContent).toBe("Overview");
    expect(options[1]?.textContent).toBe("Game window");

    const instance = await initAppI18n();
    await instance.changeLanguage("fr");

    expect(options[0]?.textContent).toBe("Vue d'ensemble");
    expect(options[1]?.textContent).toBe("Fenêtre de jeu");

    await instance.changeLanguage("en");
  });
});
