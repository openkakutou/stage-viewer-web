# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The background preview now plays back over time: elements with a configured scroll ratio visibly move at a different rate than others as a simulated camera pans, and animated background elements cycle through their frames. A Play/Pause control starts and stops playback; pausing and resuming never resets or skips ahead. An animated element referencing a non-existent frame sequence, or a frame whose sprite is missing from the sheet, shows a clear error indicator instead of freezing or crashing the preview.

## [0.5.0] - 2026-08-27

### Added

- After loading a stage, every configured background element/layer is now listed (name, type, position, layer) next to a live visual preview of the composed background, drawn in the correct front-to-back order. Selecting an element in the list highlights it in the preview. A background element referencing a sprite missing from the loaded sprite sheet shows a clear placeholder instead of breaking the preview, and a stage with no background elements shows an explicit message instead of a blank preview.

## [0.4.0] - 2026-08-26

### Added

- After loading a stage, its name, author, camera bounds, and stage boundaries are now shown right away, with a missing name or author displayed as "Unknown" instead of a blank field, and a clear note on whether the loaded stage is 2D or 3D.

## [0.3.0] - 2026-08-25

### Added

- Users can now load a stage by picking or dragging in the folder that contains its files — the app reads them, automatically finds the referenced background sprite sheet even in a subfolder or under a slightly different letter case, and clearly names which file is missing if it can't be found.

## [0.2.0] - 2026-08-25

### Added

- The app now uses the shared OpenKakutou design system for its layout and visual style, and can load a stage file (background, camera, and layer data) through the underlying stage library — the on-screen file loading and preview screens themselves come in later updates.

[Unreleased]: https://github.com/openkakutou/stage-viewer-web/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/openkakutou/stage-viewer-web/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/openkakutou/stage-viewer-web/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/openkakutou/stage-viewer-web/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/openkakutou/stage-viewer-web/releases/tag/v0.2.0
