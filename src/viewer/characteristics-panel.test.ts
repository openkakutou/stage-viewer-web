import { describe, expect, it } from "vitest";
import type { StageData } from "../wasm/types.ts";
import { renderCharacteristicsPanel } from "./characteristics-panel.ts";

function stageWith(overrides: Partial<StageData> = {}): StageData {
  return {
    name: "Training Room",
    author: "Elecbyte",
    bgDef: {
      spriteFile: "stage0.sff",
      localCoordWidth: 320,
      localCoordHeight: 240,
      zOffset: 220,
      zoomOut: 0.75,
      zoomIn: 1.5,
      modelFile: "",
      near: 0,
      far: 0,
      fov: 0,
      yShift: 0,
    },
    elements: null,
    cameraBounds: { left: -180, right: 180, high: -240, low: 0 },
    stageBoundaries: { left: -1000, right: 1000, topBound: 0, bottomBound: 0 },
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
    ...overrides,
  };
}

describe("renderCharacteristicsPanel", () => {
  it("displays the stage's name and author when both are set", () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(root, stageWith());

    expect(root.textContent).toContain("Training Room");
    const author = root.querySelector(".characteristics-panel__author dd");
    expect(author?.textContent).toBe("Elecbyte");
  });

  it('displays "Unknown" for a missing author, without affecting the name', () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(root, stageWith({ author: "" }));

    const name = root.querySelector(".characteristics-panel__name");
    expect(name?.textContent).toBe("Training Room");
    const author = root.querySelector(".characteristics-panel__author dd");
    expect(author?.textContent).toBe("Unknown");
  });

  it('displays "Unknown" independently for a stage missing both name and author', () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(root, stageWith({ name: "", author: "" }));

    const name = root.querySelector(".characteristics-panel__name");
    expect(name?.textContent).toBe("Unknown");
    const author = root.querySelector(".characteristics-panel__author dd");
    expect(author?.textContent).toBe("Unknown");
  });

  it("displays the stage's camera bounds", () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(
      root,
      stageWith({
        cameraBounds: { left: -180, right: 180, high: -240, low: 0 },
      }),
    );

    const stats = root.querySelectorAll(
      ".characteristics-panel__camera-bounds dd",
    );
    expect(Array.from(stats).map((dd) => dd.textContent)).toEqual([
      "-180",
      "180",
      "-240",
      "0",
    ]);
  });

  it("displays a 2D stage's boundaries and states the stage is 2D", () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(
      root,
      stageWith({
        bgDef: { ...stageWith().bgDef, modelFile: "" },
        stageBoundaries: {
          left: -1000,
          right: 1000,
          topBound: 0,
          bottomBound: 0,
        },
      }),
    );

    const stats = root.querySelectorAll(
      ".characteristics-panel__stage-boundaries dd",
    );
    expect(Array.from(stats).map((dd) => dd.textContent)).toEqual([
      "-1000",
      "1000",
      "0",
      "0",
    ]);
    const dimension = root.querySelector(".characteristics-panel__dimension");
    expect(dimension?.textContent).toContain("2D");
  });

  it("displays a 3D stage's top/bottom boundaries and states the stage is 3D", () => {
    const root = document.createElement("div");

    renderCharacteristicsPanel(
      root,
      stageWith({
        bgDef: { ...stageWith().bgDef, modelFile: "arena.md3" },
        stageBoundaries: {
          left: -1000,
          right: 1000,
          topBound: 500,
          bottomBound: -100,
        },
      }),
    );

    const stats = root.querySelectorAll(
      ".characteristics-panel__stage-boundaries dd",
    );
    expect(Array.from(stats).map((dd) => dd.textContent)).toEqual([
      "-1000",
      "1000",
      "500",
      "-100",
    ]);
    const dimension = root.querySelector(".characteristics-panel__dimension");
    expect(dimension?.textContent).toContain("3D");
  });

  it("renders nothing when no stage is loaded", () => {
    const root = document.createElement("div");
    root.textContent = "placeholder";

    renderCharacteristicsPanel(root, null);

    expect(root.textContent).toBe("");
  });
});
