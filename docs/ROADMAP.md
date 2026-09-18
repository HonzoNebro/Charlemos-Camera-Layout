# Roadmap

## Current (3.x)

1. Live camera scene backgrounds
- Use one player camera as a synchronized runtime scene background.
- Support `cover`, `contain` and `fill` fitting with automatic native-background fallback.

2. Expanded camera overlays
- Anchor one transparent overlay to each player camera without resizing its video.
- Support independent top, right, bottom and left extensions in dock and popout views.

## UX renewal (implemented, release validation pending)

1. Scene-bound editing and protected imports with reviewed destinations and recovery.
2. Shared draft model with local preview, conflict resolution and 100-step undo/redo.
3. Unified Scene / Cameras / Tools navigation and English, Spanish and Galician labels.
4. Basic effect controls, explicit units, preserved custom CSS and local resource status.
5. Preset previews and selective camera/scene copying without implicit background changes.
6. Visual camera, frame and name editing with owned controls and teardown cleanup.

Automated coverage is supplemented by the required [Foundry acceptance checklist](UX_ACCEPTANCE.md). The opt-in `3.3.0-beta.1` prerelease uses the `preview/ux-editor` manifest; stable distribution remains unchanged.

## Short Term

1. Renderer stability and compatibility
- Keep camera visibility stable across Foundry `CameraViews` updates and Falemos overlays.
- Add targeted fallbacks for `video-container` sizing regressions.

2. Overlay UX polish
- Add quick presets for common frame styles.
- Add optional safe modes for frame overlays (`normal`, `screen`, `soft-light`) with live preview.

3. Scene profile workflow
- Improve macro naming and profile listing.
- Add profile duplication and clear conflict warnings when scene/profile mismatch is detected.

4. Diagnostics and support
- Keep `Renderer debug mode` and add one-click debug export.
- Add a troubleshooting guide for common A/V conflicts.

5. Release discipline
- Tag semver releases and keep manifest/download links aligned with release artifacts.

## Long Term

1. Profile library
- Global reusable profile templates, then bind templates to scenes.

2. Per-user profile variants
- Optional role-based variants (GM vs players) while keeping a shared scene baseline.

3. Visual editor improvements
- Guided controls for clip-path presets and advanced overlay alignment tools.

4. Foundry integration depth
- Evaluate optional positioned pseudo-tiles that reuse the live camera background renderer.

5. Automated quality gates
- Expand automated tests around renderer/layout edge cases and regression snapshots.
