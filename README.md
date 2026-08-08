# stage-viewer-web

A static web page for visualizing an [OpenKakutou](https://github.com/openkakutou) (MUGEN/Ikemen GO-compatible) stage (background): layers, BG elements, parallax scroll, and animated backgrounds, so a stage's composition can be thoroughly inspected. It reads stage data (`.def`) via a WebAssembly module built from the sibling [`stage`](https://github.com/openkakutou/stage) Go library. Read-only.

<!-- vibe:begin:features -->
This project is in early-stage development — only the project scaffold exists so far, no functionality yet.

Planned:

- A WASM bridge to the `stage` library, and a file input for a stage's `.def` (and referenced sprite sheet) files
- A characteristics panel: stage name/author, camera bounds, and boundaries
- A BG element/layer browser
- A live visual preview renderer for the composed background
- Animated BG playback preview: parallax scroll and animated background playback over time
<!-- vibe:end:features -->

<!-- vibe:begin:install -->
Requires [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`.

```sh
npm install
```

Verify the install worked by running the test suite:

```sh
npm test
```

To update dependencies to their latest allowed versions:

```sh
npm update
```
<!-- vibe:end:install -->

<!-- vibe:begin:usage -->
Start a local dev server with hot reload:

```sh
npm run dev
```

Build the static site for production (output in `dist/`):

```sh
npm run build
```

Preview a production build locally:

```sh
npm run preview
```

Run the test suite:

```sh
npm test
```

Run the linter/formatter (auto-fixes issues in place):

```sh
npm run lint
```
<!-- vibe:end:usage -->

<!-- vibe:begin:docs-index -->
No additional documentation yet.
<!-- vibe:end:docs-index -->
