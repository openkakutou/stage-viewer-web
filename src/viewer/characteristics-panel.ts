// Backlog item 003: the first content screen shown once a stage has loaded,
// mirroring `character-viewer-web`'s own `viewer/characteristics-panel.ts`
// shape (`<wuik-panel>` root, `replaceChildren()` + null-early-return, a
// `buildStat` helper) — appears inline automatically, no tab navigation yet,
// same convention as that sibling's own
// .vibe/decisions/005-characteristics-panel-inline-no-tab-navigation-yet.md.
//
// A missing name/author is displayed as the literal text "Unknown" rather
// than a blank field or a visually distinct treatment (italics/greyed) —
// see the acceptance criteria in .vibe/backlog/003-characteristics-panel.md.
//
// Stage boundaries are shown unconditionally, alongside an explicit
// statement of whether the stage is 2D or 3D (derived from
// `bgDef.modelFile`, the same source of truth `stage` itself uses — never
// from the boundary values being zero) — see
// .vibe/decisions/002-stage-boundaries-shown-unconditionally-with-dimension-note.md.
import type { StageData } from "../wasm/types.ts";

const UNKNOWN = "Unknown";

export function renderCharacteristicsPanel(
  root: HTMLElement,
  stage: StageData | null,
): void {
  root.replaceChildren();
  if (stage === null) return;

  const panel = document.createElement("wuik-panel");
  panel.className = "characteristics-panel";

  const name = document.createElement("h2");
  name.className = "characteristics-panel__name";
  name.textContent = stage.name || UNKNOWN;

  const identity = document.createElement("dl");
  identity.className = "characteristics-panel__author";
  identity.appendChild(buildStat("Author", stage.author || UNKNOWN));

  const is3D = stage.bgDef.modelFile !== "";

  const cameraSection = buildBoundsSection(
    "Camera Bounds",
    "characteristics-panel__camera-bounds",
    [
      ["Left", stage.cameraBounds.left],
      ["Right", stage.cameraBounds.right],
      ["High", stage.cameraBounds.high],
      ["Low", stage.cameraBounds.low],
    ],
  );

  const boundariesSection = buildBoundsSection(
    "Stage Boundaries",
    "characteristics-panel__stage-boundaries",
    [
      ["Left", stage.stageBoundaries.left],
      ["Right", stage.stageBoundaries.right],
      ["Top", stage.stageBoundaries.topBound],
      ["Bottom", stage.stageBoundaries.bottomBound],
    ],
  );
  const dimension = document.createElement("p");
  dimension.className = "characteristics-panel__dimension";
  dimension.textContent = is3D
    ? "This is a 3D stage — Top and Bottom bounds apply."
    : "This is a 2D stage — Top and Bottom bounds are not used.";
  boundariesSection.appendChild(dimension);

  panel.append(name, identity, cameraSection, boundariesSection);
  root.appendChild(panel);
}

function buildBoundsSection(
  heading: string,
  modifier: string,
  fields: Array<[string, number]>,
): HTMLElement {
  const section = document.createElement("section");
  section.className = modifier;
  const h3 = document.createElement("h3");
  h3.textContent = heading;
  const stats = document.createElement("dl");
  for (const [label, value] of fields) {
    stats.appendChild(buildStat(label, String(value)));
  }
  section.append(h3, stats);
  return section;
}

function buildStat(label: string, value: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "characteristics-panel__stat";
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  container.append(dt, dd);
  return container;
}
