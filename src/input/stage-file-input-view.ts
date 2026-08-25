// DOM component for backlog item 002 (stage folder input): folder
// selection is the only input path (a native `<input webkitdirectory>`
// picker plus a drag-and-drop zone), not a single-file picker — see
// this backlog item's own Notes for why. Every interactive control is a
// real native element (file input, radio inputs, buttons) rather than a
// custom `role="button"` div, so keyboard operability comes for free from
// the browser. Mirrors `lifebar-viewer-web`'s own
// `lifebar-folder-input-view.ts` shape, with a stricter status/error set:
// this app hard-errors, by name, when the referenced sprite sheet can't be
// resolved, rather than the sibling's silent-if-unresolved sprite step —
// see .vibe/decisions/001-sprite-sheet-resolved-by-basename-with-case-insensitive-fallback.md.
import type { GatheredFile } from "./folder-entries.ts";
import {
  type DataTransferItemLike,
  filesFromDataTransferItems,
  filesFromWebkitDirectoryFiles,
} from "./folder-entries.ts";
import {
  type StageFolderInputOptions,
  type StageFolderInputResult,
  loadStageFromChosenEntry,
  loadStageFromFolderFiles,
} from "./stage-file-input.ts";

export interface StageFileInputViewOptions {
  /** Called once a folder's stage and its sprite sheet have both loaded successfully. */
  onLoaded: (result: {
    fileName: string;
    relativePath: string;
    stage: import("../wasm/types.ts").StageData;
    defBytes: Uint8Array;
    sffFileName: string;
    sffRelativePath: string;
    sffBytes: Uint8Array;
  }) => void;
  /** Forwarded to the read/parse/resolve layer; injectable for testing. */
  fileOptions?: StageFolderInputOptions;
  /** Shorthand for `fileOptions.bridgeOptions`; ignored if `fileOptions` is also given. */
  bridgeOptions?: StageFolderInputOptions["bridgeOptions"];
}

type Phase = "idle" | "loading" | "needs-selection" | "done";

type ErrorResult = Exclude<
  StageFolderInputResult,
  { status: "success" | "needs-selection" }
>;

function formatSuccessMessage(
  result: Extract<StageFolderInputResult, { status: "success" }>,
): string {
  return `Loaded ${result.fileName}. Sprite sheet: ${result.sffFileName}.`;
}

function formatErrorMessage(
  result: ErrorResult,
  source: "picker" | "drop",
): string {
  switch (result.status) {
    case "no-files":
      return source === "drop"
        ? "Couldn't read anything from the dropped folder — your browser may not support folder drag-and-drop here. Try the folder picker button instead."
        : "This folder is empty — pick a folder that contains the stage's .def file.";
    case "no-candidate":
      return "No .def file found in this folder — expected one like stage.def.";
    case "read-error":
      return `Could not read ${result.fileName}: ${result.message}`;
    case "parse-error":
      return `Could not parse ${result.fileName}: ${result.message}`;
    case "sprite-not-found":
      return result.referencedName === ""
        ? `${result.fileName} doesn't reference a sprite sheet.`
        : `${result.fileName} references "${result.referencedName}", but that file wasn't found anywhere in the folder.`;
    case "sprite-ambiguous":
      return `${result.fileName} references "${result.referencedName}", but ${result.candidates.length} files in the folder share that name — could not tell which one to use.`;
    case "sprite-read-error":
      return `Could not read ${result.sffFileName}: ${result.message}`;
  }
}

/**
 * Renders the folder-based stage input into `root`, replacing its
 * previous content.
 */
export function renderStageFileInput(
  root: HTMLElement,
  options: StageFileInputViewOptions,
): void {
  root.replaceChildren();

  const fileOptions: StageFolderInputOptions = {
    ...options.fileOptions,
    bridgeOptions: options.fileOptions?.bridgeOptions ?? options.bridgeOptions,
  };

  let phase: Phase = "idle";
  let statusMessage = "";
  let isError = false;
  let lastSource: "picker" | "drop" = "picker";
  let selectedIndex: number | null = null;
  let lastGatheredFiles: GatheredFile[] = [];

  const panel = document.createElement("div");
  panel.className = "stage-file-input";

  const dropZone = document.createElement("div");
  dropZone.className = "stage-file-input__dropzone";

  const label = document.createElement("label");
  label.className = "stage-file-input__label";
  label.htmlFor = "stage-folder-picker";
  label.textContent =
    "Select a stage folder (containing its .def file, e.g. stage.def)";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.id = "stage-folder-picker";
  picker.setAttribute("webkitdirectory", "");
  picker.multiple = true;

  const hint = document.createElement("p");
  hint.className = "stage-file-input__hint";
  hint.textContent = "…or drag and drop a stage folder here";

  dropZone.append(label, picker, hint);

  const selectionContainer = document.createElement("div");
  selectionContainer.className = "stage-file-input__selection";
  selectionContainer.hidden = true;

  const status = document.createElement("div");
  status.className = "stage-file-input__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "stage-file-input__reset";
  resetButton.dataset.action = "reset";
  resetButton.textContent = "Choose a different folder";
  resetButton.hidden = true;

  panel.append(dropZone, selectionContainer, status, resetButton);
  root.appendChild(panel);

  function render(): void {
    picker.disabled = phase === "loading";
    dropZone.classList.toggle(
      "stage-file-input__dropzone--loading",
      phase === "loading",
    );
    status.classList.toggle("stage-file-input__status--error", isError);
    status.textContent = statusMessage;
    resetButton.hidden = phase === "idle" || phase === "loading";
    selectionContainer.hidden = phase !== "needs-selection";
  }

  function resetToIdle(): void {
    phase = "idle";
    statusMessage = "";
    isError = false;
    selectedIndex = null;
    picker.value = "";
    selectionContainer.replaceChildren();
    render();
  }

  function renderSelection(candidates: GatheredFile[]): void {
    selectionContainer.replaceChildren();
    selectedIndex = null;

    const prompt = document.createElement("p");
    prompt.textContent = "Which file is the stage?";

    const group = document.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Candidate stage files");

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.dataset.action = "confirm-selection";
    confirmButton.textContent = "Load selected file";
    confirmButton.disabled = true;

    candidates.forEach((candidate, index) => {
      const optionLabel = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "stage-candidate";
      input.value = String(index);
      // A jsdom quirk: `.click()` on a radio reliably toggles `.checked`
      // but doesn't reliably synthesize a "change" event under this
      // project's pinned jsdom — read the selection from "click" instead,
      // the same workaround `character-viewer-web`'s animation player and
      // `lifebar-viewer-web`'s folder input use.
      input.addEventListener("click", () => {
        selectedIndex = index;
        confirmButton.disabled = false;
      });
      optionLabel.append(
        input,
        document.createTextNode(` ${candidate.relativePath}`),
      );
      group.appendChild(optionLabel);
    });

    confirmButton.addEventListener("click", () => {
      if (selectedIndex === null) return;
      const chosen = candidates[selectedIndex];
      phase = "loading";
      statusMessage = `Reading ${chosen.file.name}…`;
      isError = false;
      render();
      void finishLoading(
        loadStageFromChosenEntry(chosen, lastGatheredFiles, fileOptions),
      );
    });

    selectionContainer.append(prompt, group, confirmButton);
  }

  async function finishLoading(
    resultPromise: Promise<StageFolderInputResult>,
  ): Promise<void> {
    const result = await resultPromise;

    if (result.status === "success") {
      phase = "done";
      isError = false;
      statusMessage = formatSuccessMessage(result);
      render();
      options.onLoaded(result);
      return;
    }

    if (result.status === "needs-selection") {
      phase = "needs-selection";
      isError = false;
      statusMessage = `Found ${result.candidates.length} possible stage files — pick which one to load.`;
      renderSelection(result.candidates);
      render();
      return;
    }

    phase = "done";
    isError = true;
    statusMessage = formatErrorMessage(result, lastSource);
    render();
  }

  function handleGathered(
    files: GatheredFile[],
    source: "picker" | "drop",
  ): void {
    lastSource = source;
    lastGatheredFiles = files;
    phase = "loading";
    statusMessage = "Reading…";
    isError = false;
    selectionContainer.replaceChildren();
    render();
    void finishLoading(loadStageFromFolderFiles(files, fileOptions));
  }

  picker.addEventListener("change", () => {
    const files = picker.files ? Array.from(picker.files) : [];
    handleGathered(filesFromWebkitDirectoryFiles(files), "picker");
  });

  resetButton.addEventListener("click", resetToIdle);

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropZone.classList.add("stage-file-input__dropzone--dragging");
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("stage-file-input__dropzone--dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("stage-file-input__dropzone--dragging");
    const dataTransfer = (event as DragEvent).dataTransfer as {
      items?: ArrayLike<DataTransferItemLike>;
    } | null;
    const items = dataTransfer?.items ? Array.from(dataTransfer.items) : [];
    void filesFromDataTransferItems(items).then((files) =>
      handleGathered(files, "drop"),
    );
  });

  render();
}
