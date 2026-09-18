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

Automated coverage is supplemented by the required [Foundry acceptance checklist](UX_ACCEPTANCE.md). The opt-in `3.3.0-beta.2` prerelease uses the `preview/ux-editor` manifest; stable distribution remains unchanged.

## Short Term (implemented for 3.3.0-beta.2; Foundry acceptance pending)

1. Renderer stability and compatibility
- Reactive avatar listeners are released on video/view replacement and scene cleanup. Legacy Falemos frame-asset styling is preserved; running two camera DOM managers together is not guaranteed compatible.
- Collapsed video-container sizing receives a reversible fallback only under module geometry; healthy, hidden, minimized and native-controlled views are left unchanged.

2. Overlay UX polish
- Quick frame presets are implemented in the preview branch: inside, 10% exterior and 25% lower space, with local draft preview, one-step undo and schematic bounds. Foundry visual acceptance remains pending.
- Optional frame blending (`normal`, `screen`, `soft-light`) is implemented with local draft preview, one-step undo and a legacy automatic mode. Automated regression coverage includes repeated blend-mode transitions; Foundry visual validation remains pending.

3. Scene profile workflow
- Saved profiles list scene names/IDs, camera counts, control mode and missing references. Suggested macro names include scene and saved/draft state and avoid existing names; custom duplicate names require confirmation.
- Composition duplication reviews added/replaced user IDs and opens a destination-bound draft, preserving destination-only cameras and excluding the background. Changed or deleted source/destination contexts block duplication; Apply still requires the destination scene.

4. Diagnostics and support
- Renderer debug mode and existing logs remain. Diagnostic JSON downloads are available in Tools and the report window, with privacy guidance and edited/viewed scene identity.
- Troubleshooting guides cover common A/V conflicts, frame fitting/blending, profiles and reporting in English, Spanish and Galician.

5. Release discipline
- The beta uses a matching changelog, package/module version, immutable tag archive and GitHub prerelease without Latest. Stable manifests remain on main; beta manifests remain on preview/ux-editor.

## Long Term (deferred by user decision; not part of this beta)

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
