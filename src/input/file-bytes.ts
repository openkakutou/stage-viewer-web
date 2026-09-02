// Shared by every folder-input consumer that needs to read a gathered
// File's raw bytes (the stage's own `.def`, its sprite sheet, and — per
// backlog item 006 — an optional 3D model/`.hdr` environment file). Kept in
// its own module so `stage-file-input.ts` and `model-assets.ts` can both
// depend on it without depending on each other.
/**
 * Reads a File's bytes via `FileReader` rather than `Blob#arrayBuffer()` —
 * the pinned jsdom version's `Blob` implementation is incomplete, the same
 * real-browser/jsdom parity reason every other OpenKakutou app's file
 * input uses `FileReader` instead.
 */
export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error("FileReader did not return an ArrayBuffer"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
}
