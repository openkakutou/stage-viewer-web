# stage-viewer-web

A static web page for visualizing an [OpenKakutou](https://github.com/openkakutou) (MUGEN/Ikemen GO-compatible) stage (background): layers, BG elements, parallax scroll, and animated backgrounds, so a stage's composition can be thoroughly inspected. It reads stage data (`.def`) via a WebAssembly module built from the sibling [`stage`](https://github.com/openkakutou/stage) Go library. Read-only.

<!-- vibe:begin:features -->
This project is in early-stage development — there is no way to load or view a stage from the app yet. It now uses the shared OpenKakutou design system for its layout and visual style, and the stage-reading library underneath it is wired up and ready for the file input below.

Planned:

- A file input for a stage's `.def` (and referenced sprite sheet) files
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

Download a specific version of the `stage` library's WebAssembly build (needed to load a stage):

```sh
npm run wasm:download -- v0.7.0
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
- [docs/architecture.md](docs/architecture.md) — how the app is put together: the main modules, how a stage's data would flow through them, and its WebAssembly dependency.
- [docs/development.md](docs/development.md) — local dev setup notes, including how to fetch the `stage` library's WebAssembly build.
- [docs/testing.md](docs/testing.md) — how the test suite is structured, including how it exercises the real WebAssembly module and works around test-environment quirks.
<!-- vibe:end:docs-index -->
