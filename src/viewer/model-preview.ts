// Backlog item 006: renders an Ikemen GO 3D model-based stage's glTF model,
// lit by its `.hdr` environment (image-based lighting), inside `web-ui-kit`'s
// `<wuik-viewport-3d>` orbit/pan/zoom camera control. That control owns only
// camera *math* (see its own repo's .vibe/decisions/010) — every actual
// three.js scene/renderer/loader concern below is this module's own job.
// See .vibe/decisions/005-3d-model-preview-design.md for the full design.
//
// `three` and its loaders are only ever dynamically imported from inside
// this file's default option functions, and those are only ever called
// once `modelAssets.status === "success"` — a 2D-only stage (the common
// case) never pays the cost of downloading or evaluating this module's
// heaviest dependency at all.
import type * as THREE from "three";
import type { ModelAssetsResolution } from "../input/model-assets.ts";
import type { StageData } from "../wasm/types.ts";
import { resolveCameraParams, resolveModelTransform } from "./model-camera.ts";

/** The minimal shape this module needs from a loaded glTF result — deliberately
 * never reads `animations`: no skeletal/armature animation is ever played,
 * matching Ikemen GO's own current limitation (see the backlog item's own
 * acceptance criteria). Kept narrower than three.js's own `GLTF` type,
 * which also carries cameras/userData/etc. this module never touches. */
export interface LoadedModel {
  readonly scene: THREE.Object3D;
}

/** The camera snapshot shape `<wuik-viewport-3d>` exposes via `getCamera()`
 * and its `wuik-viewport3d-change` event — duck-typed locally since only
 * the component's class, not this data shape, is part of `web-ui-kit`'s
 * public export surface (see that repo's `src/canvas3d/index.ts`). */
export interface CameraSnapshotLike {
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface ModelPreviewOptions {
  /** Constructs the WebGL renderer for `canvas`, or `null` if none could be created (no WebGL support, driver blocklist, etc). Defaults to a real `THREE.WebGLRenderer`; injectable for testing. */
  createRenderer?: (
    canvas: HTMLCanvasElement,
  ) => THREE.WebGLRenderer | null | Promise<THREE.WebGLRenderer | null>;
  /** Parses the stage's referenced glTF model bytes. Defaults to the real `GLTFLoader`; injectable for testing. */
  loadGLTF?: (bytes: Uint8Array) => Promise<LoadedModel>;
  /** Parses the stage's referenced `.hdr` bytes into an environment (IBL) texture, or `null` if it couldn't be built. Defaults to the real `HDRLoader` + `PMREMGenerator`; injectable for testing. */
  loadEnvironment?: (
    renderer: THREE.WebGLRenderer,
    bytes: Uint8Array,
  ) => THREE.Texture | null | Promise<THREE.Texture | null>;
  /** Schedules the next coalesced render. Defaults to the real global; injectable for deterministic testing. */
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  /** Cancels a scheduled render. Defaults to the real global; injectable for deterministic testing. */
  cancelAnimationFrame?: (handle: number) => void;
  /** Constructs the `ResizeObserver` watching the viewport's host size. Defaults to the real global (skipped entirely if unavailable); injectable for testing. */
  ResizeObserverCtor?: typeof ResizeObserver;
}

/** Copies `bytes` into a fresh, non-shared `ArrayBuffer` slice for a loader's `.parse()` call. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

async function defaultCreateRenderer(
  canvas: HTMLCanvasElement,
): Promise<THREE.WebGLRenderer | null> {
  try {
    const THREE_ = await import("three");
    return new THREE_.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
}

async function defaultLoadGLTF(bytes: Uint8Array): Promise<LoadedModel> {
  const { GLTFLoader } = await import(
    "three/examples/jsm/loaders/GLTFLoader.js"
  );
  const loader = new GLTFLoader();
  const buffer = toArrayBuffer(bytes);
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      "",
      (gltf) => resolve({ scene: gltf.scene }),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

async function defaultLoadEnvironment(
  renderer: THREE.WebGLRenderer,
  bytes: Uint8Array,
): Promise<THREE.Texture | null> {
  try {
    const THREE_ = await import("three");
    const { HDRLoader } = await import(
      "three/examples/jsm/loaders/HDRLoader.js"
    );
    const buffer = toArrayBuffer(bytes);
    const loader = new HDRLoader();
    const parsed = loader.parse(buffer);
    if (!parsed) return null;

    const dataTexture = new THREE_.DataTexture(
      parsed.data,
      parsed.width,
      parsed.height,
      parsed.format,
      parsed.type,
    );
    dataTexture.mapping = THREE_.EquirectangularReflectionMapping;
    dataTexture.needsUpdate = true;

    const pmrem = new THREE_.PMREMGenerator(renderer);
    const envMap = pmrem.fromEquirectangular(dataTexture).texture;
    dataTexture.dispose();
    pmrem.dispose();
    return envMap;
  } catch {
    return null;
  }
}

/** Reads `<wuik-viewport-3d>`'s current camera via its real `getCamera()` method
 * if the real, registered custom element is present — a plain `HTMLElement`
 * (this project's test environment never registers `@openkakutou/web-ui-kit`'s
 * custom elements) has no such method, so this is a safe no-op there; the
 * real behavior is verified by a real-browser runtime pass instead, same
 * convention as `background-preview.ts`'s own `resetViewportToFit`. */
function readCameraSnapshot(viewport: HTMLElement): CameraSnapshotLike | null {
  const getCamera = (
    viewport as unknown as { getCamera?: () => CameraSnapshotLike }
  ).getCamera;
  return typeof getCamera === "function" ? getCamera.call(viewport) : null;
}

function describeAssetFailure(
  resolution: Exclude<
    ModelAssetsResolution,
    { status: "none" } | { status: "success" }
  >,
): string {
  switch (resolution.status) {
    case "model-not-found":
      return `The referenced 3D model "${resolution.referencedName}" was not found in the loaded folder.`;
    case "model-ambiguous":
      return `Multiple files named "${resolution.referencedName}" were found in the loaded folder — could not tell which one to use as the 3D model.`;
    case "model-read-error":
      return `The 3D model file "${resolution.fileName}" could not be read: ${resolution.message}`;
    case "environment-not-found":
      return `The referenced lighting file "${resolution.referencedName}" was not found in the loaded folder.`;
    case "environment-ambiguous":
      return `Multiple files named "${resolution.referencedName}" were found in the loaded folder — could not tell which one to use for lighting.`;
    case "environment-read-error":
      return `The lighting file "${resolution.fileName}" could not be read: ${resolution.message}`;
  }
}

function buildFailureBanner(bodyText: string): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "model-preview__error";
  banner.setAttribute("role", "status");
  const heading = document.createElement("p");
  heading.className = "model-preview__error-heading";
  heading.textContent = "3D preview unavailable";
  const body = document.createElement("p");
  body.className = "model-preview__error-body";
  body.textContent = bodyText;
  banner.append(heading, body);
  return banner;
}

// Tears down a previous call's three.js setup (renderer, observers,
// listeners, pending rAF) when `renderModelPreview` is invoked again on the
// same root — same "cancel the old instance's own loop/listeners" rule
// `background-preview.ts`'s own `stopPlaybackByRoot` already established.
const stopByRoot = new WeakMap<HTMLElement, () => void>();

export function renderModelPreview(
  root: HTMLElement,
  stage: StageData | null,
  modelAssets: ModelAssetsResolution,
  options: ModelPreviewOptions = {},
): void {
  stopByRoot.get(root)?.();
  stopByRoot.delete(root);

  root.replaceChildren();

  if (stage === null || modelAssets.status === "none") {
    return;
  }

  if (modelAssets.status !== "success") {
    root.appendChild(buildFailureBanner(describeAssetFailure(modelAssets)));
    return;
  }

  const createRendererFn = options.createRenderer ?? defaultCreateRenderer;
  const loadGLTFFn = options.loadGLTF ?? defaultLoadGLTF;
  const loadEnvironmentFn = options.loadEnvironment ?? defaultLoadEnvironment;
  const requestAnimationFrameFn =
    options.requestAnimationFrame ??
    globalThis.requestAnimationFrame.bind(globalThis);
  const cancelAnimationFrameFn =
    options.cancelAnimationFrame ??
    globalThis.cancelAnimationFrame.bind(globalThis);
  const ResizeObserverCtor =
    options.ResizeObserverCtor ??
    (typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined);

  const viewport = document.createElement("wuik-viewport-3d");
  viewport.className = "model-preview__viewport";
  const canvas = document.createElement("canvas");
  canvas.className = "model-preview__canvas";
  viewport.appendChild(canvas);
  root.appendChild(viewport);

  let disposed = false;
  let rafHandle: number | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let scene: THREE.Scene | null = null;
  let resizeObserver: ResizeObserver | null = null;

  stopByRoot.set(root, () => {
    disposed = true;
    if (rafHandle !== null) cancelAnimationFrameFn(rafHandle);
    resizeObserver?.disconnect();
    renderer?.dispose();
  });

  function requestRender(): void {
    if (rafHandle !== null || !renderer || !camera || !scene) return;
    const activeRenderer = renderer;
    const activeCamera = camera;
    const activeScene = scene;
    rafHandle = requestAnimationFrameFn(() => {
      rafHandle = null;
      if (disposed) return;
      applySurfaceColor(activeRenderer, canvas);
      activeRenderer.render(activeScene, activeCamera);
    });
  }

  function applySurfaceColor(
    activeRenderer: THREE.WebGLRenderer,
    surfaceCanvas: HTMLCanvasElement,
  ): void {
    // Re-read on every render, never cached from mount, so a live OS-level
    // prefers-color-scheme change is reflected immediately — same "don't
    // bake in a first-paint value" rule background-preview.ts's own
    // defaultDrawComposition already follows.
    const surfaceColor =
      getComputedStyle(surfaceCanvas)
        .getPropertyValue("--wuik-color-surface")
        .trim() || "#e5e5e5";
    try {
      activeRenderer.setClearColor(
        surfaceColor as unknown as THREE.ColorRepresentation,
      );
    } catch {
      // A CSS custom property this renderer's Color constructor can't
      // parse (e.g. unresolved under a test environment) — the previous
      // clear color stays in effect rather than throwing mid-render.
    }
  }

  (async () => {
    const [rendererOutcome, gltfOutcome] = await Promise.allSettled([
      Promise.resolve(createRendererFn(canvas)),
      Promise.resolve(loadGLTFFn(modelAssets.modelBytes)),
    ]);
    if (disposed) return;

    const createdRenderer =
      rendererOutcome.status === "fulfilled" ? rendererOutcome.value : null;
    if (!createdRenderer) {
      root.replaceChildren(
        buildFailureBanner(
          "This browser or environment could not create a WebGL renderer for the 3D preview.",
        ),
      );
      return;
    }
    renderer = createdRenderer;

    if (gltfOutcome.status === "rejected") {
      renderer.dispose();
      renderer = null;
      root.replaceChildren(
        buildFailureBanner(
          `The 3D model could not be loaded: ${
            gltfOutcome.reason instanceof Error
              ? gltfOutcome.reason.message
              : String(gltfOutcome.reason)
          }`,
        ),
      );
      return;
    }
    const model = gltfOutcome.value;

    const transform = resolveModelTransform(stage.model);
    model.scene.position.set(...transform.position);
    model.scene.scale.set(...transform.scale);

    const THREE_ = await import("three");
    if (disposed) return;

    scene = new THREE_.Scene();
    scene.add(model.scene);

    const camParams = resolveCameraParams(stage.bgDef);
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera = new THREE_.PerspectiveCamera(
      camParams.fov,
      width / height,
      camParams.near,
      camParams.far,
    );

    if (modelAssets.environmentBytes !== null) {
      const env = await Promise.resolve(
        loadEnvironmentFn(renderer, modelAssets.environmentBytes),
      );
      if (disposed) return;
      if (env) scene.environment = env;
    }

    const initialSnapshot = readCameraSnapshot(viewport);
    if (initialSnapshot) {
      camera.position.set(
        initialSnapshot.position.x,
        initialSnapshot.position.y,
        initialSnapshot.position.z,
      );
      camera.lookAt(
        initialSnapshot.target.x,
        initialSnapshot.target.y,
        initialSnapshot.target.z,
      );
    }

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

    // Warm-up render, bypassing the demand-gate below on purpose: three.js
    // compiles shaders/materials on first draw, so the first *user-
    // triggered* render must not be the one that pays that stall.
    applySurfaceColor(renderer, canvas);
    renderer.render(scene, camera);

    viewport.addEventListener("wuik-viewport3d-change", (event) => {
      if (!camera) return;
      const detail = (event as CustomEvent<CameraSnapshotLike>).detail;
      camera.position.set(
        detail.position.x,
        detail.position.y,
        detail.position.z,
      );
      camera.lookAt(detail.target.x, detail.target.y, detail.target.z);
      requestRender();
    });

    renderer.domElement.addEventListener("webglcontextrestored", () => {
      requestRender();
    });

    if (ResizeObserverCtor) {
      resizeObserver = new ResizeObserverCtor((entries) => {
        const entry = entries[0];
        if (!entry || !renderer || !camera) return;
        const box = entry.contentBoxSize?.[0];
        const w = box?.inlineSize ?? 0;
        const h = box?.blockSize ?? 0;
        if (w <= 0 || h <= 0) return; // guards a 0×0 first observation before layout
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        requestRender();
      });
      resizeObserver.observe(viewport);
    }
  })();
}
