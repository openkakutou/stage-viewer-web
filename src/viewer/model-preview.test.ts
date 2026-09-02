import { describe, expect, it, vi } from "vitest";
import type { ModelAssetsResolution } from "../input/model-assets.ts";
import type { BGdef, Model, StageData } from "../wasm/types.ts";
import { renderModelPreview } from "./model-preview.ts";

function bgDef(overrides: Partial<BGdef> = {}): BGdef {
  return {
    spriteFile: "stage0.sff",
    localCoordWidth: 320,
    localCoordHeight: 240,
    zOffset: 0,
    zoomOut: 1,
    zoomIn: 1,
    modelFile: "",
    near: 1,
    far: 1000,
    fov: 45,
    yShift: 0,
    ...overrides,
  };
}

function model(overrides: Partial<Model> = {}): Model {
  return {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    environment: "",
    environmentIntensity: 1,
    ...overrides,
  };
}

function stage(overrides: Partial<StageData> = {}): StageData {
  return {
    name: "",
    author: "",
    bgDef: bgDef(),
    elements: null,
    animations: null,
    cameraBounds: { left: 0, right: 0, high: 0, low: 0 },
    stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
    model: model(),
    scaling: {
      depthToScreen: 1,
      topZ: 0,
      bottomZ: 0,
      topScale: 1,
      bottomScale: 1,
    },
    playerStartZ: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0 },
    ...overrides,
  };
}

const modelBytes = new Uint8Array([1, 2, 3]);

/** A minimal fake WebGLRenderer exposing only the methods this module calls. */
function fakeRenderer() {
  return {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement("canvas"),
    // biome-ignore lint/suspicious/noExplicitAny: minimal test double, not the real class
  } as any;
}

/** Captures the callback passed to `new ResizeObserver(cb)` for manual firing. */
function fakeResizeObserverCtor() {
  let capturedCallback: ResizeObserverCallback | null = null;
  const observe = vi.fn();
  const disconnect = vi.fn();
  class FakeResizeObserver {
    constructor(cb: ResizeObserverCallback) {
      capturedCallback = cb;
    }
    observe = observe;
    disconnect = disconnect;
  }
  return {
    ctor: FakeResizeObserver as unknown as typeof ResizeObserver,
    observe,
    disconnect,
    fire: (entries: ResizeObserverEntry[]) =>
      capturedCallback?.(entries, {} as ResizeObserver),
  };
}

function successAssets(
  overrides: Partial<
    Extract<ModelAssetsResolution, { status: "success" }>
  > = {},
): ModelAssetsResolution {
  return {
    status: "success",
    modelBytes,
    modelFileName: "mystage.glb",
    environmentBytes: null,
    environmentFileName: null,
    ...overrides,
  };
}

describe("renderModelPreview — no 3D content", () => {
  it("renders nothing for a null stage", () => {
    const root = document.createElement("div");
    root.appendChild(document.createElement("span"));
    renderModelPreview(root, null, { status: "none" });
    expect(root.children.length).toBe(0);
  });

  it("renders nothing when modelAssets is 'none' (no [Model] data)", () => {
    const root = document.createElement("div");
    renderModelPreview(root, stage(), { status: "none" });
    expect(root.children.length).toBe(0);
    expect(root.querySelector("wuik-viewport-3d")).toBeNull();
  });
});

describe("renderModelPreview — asset resolution failures", () => {
  const failureCases: ModelAssetsResolution[] = [
    { status: "model-not-found", referencedName: "mystage.glb" },
    {
      status: "model-ambiguous",
      referencedName: "mystage.glb",
      candidates: [],
    },
    {
      status: "model-read-error",
      fileName: "mystage.glb",
      message: "disk error",
    },
    { status: "environment-not-found", referencedName: "env.hdr" },
    {
      status: "environment-ambiguous",
      referencedName: "env.hdr",
      candidates: [],
    },
    {
      status: "environment-read-error",
      fileName: "env.hdr",
      message: "disk error",
    },
  ];

  for (const failure of failureCases) {
    it(`shows a failure banner, not a 3D viewport, for ${failure.status}`, () => {
      const root = document.createElement("div");
      renderModelPreview(
        root,
        stage({ bgDef: bgDef({ modelFile: "mystage.glb" }) }),
        failure,
      );
      expect(root.querySelector("wuik-viewport-3d")).toBeNull();
      const banner = root.querySelector(".model-preview__error");
      expect(banner).not.toBeNull();
      expect(banner?.textContent?.length ?? 0).toBeGreaterThan(0);
    });
  }
});

describe("renderModelPreview — success path", () => {
  it("mounts a wuik-viewport-3d with a canvas and constructs a renderer from it", () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const loadGLTF = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves — just checking mount

    renderModelPreview(
      root,
      stage({ bgDef: bgDef({ modelFile: "mystage.glb" }) }),
      successAssets(),
      { createRenderer, loadGLTF },
    );

    const viewport = root.querySelector("wuik-viewport-3d");
    expect(viewport).not.toBeNull();
    const canvas = viewport?.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(createRenderer).toHaveBeenCalledWith(canvas);
    expect(loadGLTF).toHaveBeenCalledWith(modelBytes);
  });

  it("shows the failure banner when the renderer can't be constructed (no WebGL)", async () => {
    const root = document.createElement("div");
    const createRenderer = vi.fn().mockReturnValue(null);

    renderModelPreview(root, stage(), successAssets(), { createRenderer });
    await vi.waitFor(() => {
      expect(root.querySelector(".model-preview__error")).not.toBeNull();
    });

    expect(root.querySelector("wuik-viewport-3d")).toBeNull();
  });

  it("shows the failure banner when the glTF fails to load, and disposes the renderer", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const loadGLTF = vi.fn().mockRejectedValue(new Error("corrupt glTF"));

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
    });
    await vi.waitFor(() => {
      expect(root.querySelector(".model-preview__error")).not.toBeNull();
    });

    expect(root.querySelector("wuik-viewport-3d")).toBeNull();
    expect(renderer.dispose).toHaveBeenCalled();
  });

  it("performs a warm-up render once the glTF has loaded", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
  });

  it("positions and scales the loaded model per the stage's [Model] offset/scale", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);

    renderModelPreview(
      root,
      stage({
        model: model({
          offsetX: 1,
          offsetY: 2,
          offsetZ: 3,
          scaleX: 4,
          scaleY: 5,
          scaleZ: 6,
        }),
      }),
      successAssets(),
      { createRenderer, loadGLTF },
    );
    await vi.waitFor(() => {
      expect(sceneChild.position.set).toHaveBeenCalledWith(1, 2, 3);
    });
    expect(sceneChild.scale.set).toHaveBeenCalledWith(4, 5, 6);
  });

  it("loads and applies the environment texture when .hdr bytes were resolved", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);
    const envTexture = {};
    const loadEnvironment = vi.fn().mockReturnValue(envTexture);
    const envBytes = new Uint8Array([9, 9]);

    renderModelPreview(
      root,
      stage(),
      successAssets({
        environmentBytes: envBytes,
        environmentFileName: "env.hdr",
      }),
      { createRenderer, loadGLTF, loadEnvironment },
    );
    await vi.waitFor(() => {
      expect(loadEnvironment).toHaveBeenCalledWith(renderer, envBytes);
    });
  });

  it("re-renders when the viewport-3d dispatches a camera-change event, coalesced through requestAnimationFrame", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);
    const rafState: { callback: FrameRequestCallback | null } = {
      callback: null,
    };
    const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafState.callback = cb;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
      requestAnimationFrame,
      cancelAnimationFrame,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
    renderer.render.mockClear();

    const viewport = root.querySelector("wuik-viewport-3d") as HTMLElement;
    viewport.dispatchEvent(
      new CustomEvent("wuik-viewport3d-change", {
        detail: {
          position: { x: 1, y: 2, z: 3 },
          target: { x: 0, y: 0, z: 0 },
        },
      }),
    );

    expect(requestAnimationFrame).toHaveBeenCalled();
    rafState.callback?.(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it("keeps the renderer and camera in sync with the host's resized CSS size", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);
    const ro = fakeResizeObserverCtor();

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
      ResizeObserverCtor: ro.ctor,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
    renderer.setSize.mockClear();

    ro.fire([
      {
        contentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
        // biome-ignore lint/suspicious/noExplicitAny: minimal ResizeObserverEntry double
      } as any,
    ]);

    expect(renderer.setSize).toHaveBeenCalledWith(400, 300, false);
  });

  it("ignores a degenerate 0x0 resize observation instead of sizing the renderer to zero", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);
    const ro = fakeResizeObserverCtor();

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
      ResizeObserverCtor: ro.ctor,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
    renderer.setSize.mockClear();

    ro.fire([
      {
        contentBoxSize: [{ inlineSize: 0, blockSize: 0 }],
        // biome-ignore lint/suspicious/noExplicitAny: minimal ResizeObserverEntry double
      } as any,
    ]);

    expect(renderer.setSize).not.toHaveBeenCalled();
  });

  it("re-renders when the WebGL context is restored after being lost", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
    renderer.render.mockClear();

    renderer.domElement.dispatchEvent(new Event("webglcontextrestored"));

    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });
  });

  it("disposes the previous renderer and stops listening when called again on the same root", async () => {
    const root = document.createElement("div");
    const renderer = fakeRenderer();
    const createRenderer = vi.fn().mockReturnValue(renderer);
    const sceneChild = { position: { set: vi.fn() }, scale: { set: vi.fn() } };
    const loadGLTF = vi
      .fn()
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
      .mockResolvedValue({ scene: sceneChild, animations: [] } as any);

    renderModelPreview(root, stage(), successAssets(), {
      createRenderer,
      loadGLTF,
    });
    await vi.waitFor(() => {
      expect(renderer.render).toHaveBeenCalled();
    });

    renderModelPreview(root, null, { status: "none" });

    expect(renderer.dispose).toHaveBeenCalled();
    expect(root.children.length).toBe(0);
  });
});
