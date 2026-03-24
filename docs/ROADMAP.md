# Roadmap

## Short Term (1.0.x)

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

## Long Term (1.1+)

1. Profile library
- Global reusable profile templates, then bind templates to scenes.

2. Per-user profile variants
- Optional role-based variants (GM vs players) while keeping a shared scene baseline.

3. Visual editor improvements
- Guided controls for clip-path presets and advanced overlay alignment tools.

4. Foundry integration depth
- Stronger support for using camera output as scene media source with controlled sync behavior.

5. Automated quality gates
- Expand automated tests around renderer/layout edge cases and regression snapshots.
