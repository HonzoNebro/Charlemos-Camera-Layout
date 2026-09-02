# Charlemos Camera Layout

FoundryVTT V13-V14 module for advanced A/V camera styling with scene-scoped camera profiles.

<img width="2430" height="1251" alt="image" src="https://github.com/user-attachments/assets/33cc54b0-f720-4c96-938c-b3f72f3af5f2" />

## Current capabilities

- Scene-scoped camera control mode: `native` or `module`
- Absolute and relative camera layouts with persisted `top`, `left`, `width`, `height`, target, placement and gap
- Scene layout presets: dynamic grid, narrative presets, responsive or fixed units
- Scene-scoped live camera backgrounds with synchronized source selection and `cover`, `contain` or `fill` fitting
- Per-player camera overlay with URL/path + file picker
- Overlay controls: opacity, move, scale, rotate, fit mode, anchor, tint, blend mode and independent bounds
- Video effects: transform, filter, clip-path, border radius
- Camera crop masks (top/right/bottom/left)
- Name styles: source, color, font family (Foundry fonts), position, alignment, weight and italic
- Reusable scene profile macros that apply to the active scene
- Offline-player editing support
- Explicit legacy import action to copy old global layouts into the current scene
- JSON config export/import
- Runtime renderer diagnostics mode

## Scene-scoped contract

- An active scene is required before editing layout, effects, overlays, name styles, scene presets or the live camera background.
- New scenes start empty by design.
- Camera styling is stored on the current scene profile.
- A live camera background is stored separately for each scene and falls back to the native background while its source is unavailable.
- Reusing a composition across scenes is explicit: use scene macros, JSON import, or import legacy global layouts into the current scene.
- Legacy `playerLayouts` can still exist in settings, but they are no longer applied automatically at runtime.

## Live camera background

- A GM configures the source and fit from `Camera Layout Config` → `Open Camera Background`; the world-scoped choice is synchronized to every client.
- The raw, unmirrored camera video is rendered at runtime without changing the Scene document or creating a Tile. Camera frames, names, filters and HTML overlays are not included.
- The native scene background remains underneath for `contain` bands and immediate fallback. Turning off, losing or disconnecting the source removes only the runtime mesh and preserves the scene configuration for automatic recovery.
- The renderer does not duplicate audio or control the source video, and scene profile macros do not change the background.
- The public API supports `setSceneCamera(sceneId, playerId, { fit })`, the compatible two-argument form, and `resetSceneCamera(sceneId)`.

## Expanded camera overlays

- Each scene overlay is anchored to its player's camera and follows it through resize, dock and popout changes.
- `Inside Camera` preserves the original clipped behavior. `Expanded` adds independent top, right, bottom and left percentages without resizing the camera video.
- Transparent PNG or WebM media defines the visible silhouette. Docked cameras reserve enough outer spacing for the expanded artwork; popouts can draw outside their camera rectangle up to the browser viewport.
- Existing offset, scale, rotation, fit, anchor and tint controls remain available as fine adjustments.
- `setPlayerOverlay(playerId, overlay)` keeps its existing signature and writes to the active scene profile; `overlay.bounds` accepts `camera` or `expanded` plus `top`, `right`, `bottom` and `left` percentages.

## Structure

- `module.json`: Foundry module manifest
- `CHANGELOG.md`: release notes and version history
- `AGENTS.md`: permanent instructions for coding agents
- `scripts/`: module runtime code
- `styles/`: module styles
- `lang/`: i18n dictionaries
- `tests/unit/`: unit tests only
- `docs/ROADMAP.md`: short and long term roadmap
- `docs/DEVELOPMENT_RULES.md`: mandatory coding rules
- `docs/macros/dump_module_debug_report.js`: support macro for bug reports
- `.github/workflows/release-guard-pr.yml`: validates release metadata and tests on PRs to `main`
- `.github/workflows/release-tag-on-version-bump.yml`: auto-tags releases after version bumps reach `main`

## Run tests

```bash
npm test
```

## Diagnostics

- Enable `Renderer debug mode` in Foundry when investigating runtime problems.
- Open `Camera Layout Config` and use `Open Support Report` to generate a structured report for the selected player without using the browser console.
- Run the macro in `docs/macros/dump_module_debug_report.js` to dump a structured support report to the browser console.
- The module API also exposes:
  - `game.modules.get("charlemos-camera-layout")?.api?.dumpRendererDebugSnapshot(userId)`
  - `game.modules.get("charlemos-camera-layout")?.api?.dumpModuleDebugReport(userId)`

## Foundry install

- Manifest URL: `https://raw.githubusercontent.com/HonzoNebro/Charlemos-Camera-Layout/main/module.json`
- Compatibility: Foundry VTT 13-14.

## Languages

- English (`en`)
- Español (`es`)
- Galego (`gl`)

## License and provenance

- License: MIT (`LICENSE`)
- AI usage notice: included in `LICENSE`
- Asset provenance: `docs/ASSET_PROVENANCE.md`
