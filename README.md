# Charlemos Camera Layout

> **3.3.0-beta.1 — testing only.** This branch is an opt-in prerelease, not the stable distribution. Use a separate Foundry data directory and a copy of your world. It uses the same module ID and therefore replaces stable Charlemos in that installation.

Beta installation manifest: `https://raw.githubusercontent.com/HonzoNebro/Charlemos-Camera-Layout/preview/ux-editor/module.json`

This manifest follows the UX preview branch. The normal `main/module.json` manifest remains stable. To return to stable, reinstall from the stable manifest in your test installation; do not rely on an automatic downgrade. Keep the original backup until testing is finished.

FoundryVTT V13-V14 module for advanced A/V camera styling with scene-scoped camera profiles.

<img width="2430" height="1251" alt="image" src="https://github.com/user-attachments/assets/33cc54b0-f720-4c96-938c-b3f72f3af5f2" />

## Current capabilities

- Unified GM editor with Scene, Cameras and Tools sections, local drafts and explicit shared Apply
- Local preview, conflict detection, undo/redo and visual editing on actual camera views
- Reviewed JSON import with destination mapping, selective replacement and full-backup restoration
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

## Editing workflow

Open the module's configuration menu. **Scene** contains positioning control, camera background and distribution presets. **Cameras** contains position and size, video effects, frame artwork and name styling. **Tools** contains copying, macros, backups, legacy-layout import and diagnostics.

Edits stay in one in-memory draft for the scene shown in the header. Switching sections or users keeps that draft. Enable **Local preview** to see it on your own cameras without changing other clients. **Apply to everyone** saves all pending camera and scene changes and keeps the editor open. **Save and close** also closes it. Canceling discards only changes made since the last Apply; reloading Foundry loses unapplied edits.

Changing scenes suspends preview and prevents saving until you return to the edited scene. Deleted scenes cannot be saved. Offline users can still be configured. External changes to untouched fields are incorporated; overlapping edits require choosing between the saved and draft values. This detects conflicts but is not a distributed transaction or a lock against other GMs.

### Position cameras and add frames

Choose Charlemos positioning for the scene to position undocked cameras. Docked cameras retain Foundry's geometry. **Undock selected camera** acts immediately on Foundry; discarding the draft does not dock it again. Switching positioning control preserves dormant geometry.

For artwork, select **Frame / overlay image**, choose an image or video and enable it. Use **Expanded** bounds to extend above, below or beside the camera without changing the video size. Extensions are percentages of the camera dimensions. The alpha channel defines the visible silhouette, while the dock reserves space for the transformed rectangle. Edge masks are dark bands over the video and frame, not source-video reframing.

### Visual editing

In Cameras, enable **Edit on cameras** and choose Camera, Frame or Name. Camera handles move and resize undocked cameras; relative layouts can resize but require explicit conversion before free positioning. Frame handles adjust offset, uniform scale, rotation and extensions independently of camera geometry. Name dragging adjusts its existing top/bottom offset, not arbitrary two-dimensional positioning.

Snapping uses an 8 CSS-pixel tolerance and compares cameras within the same document. Aspect-ratio locking is optional. Supported units are retained. Complex CSS is preserved and must be explicitly converted or edited before an incompatible drag. Escape cancels the current gesture. Undo/redo retains up to 100 draft operations and resets after Apply. Other clients never see editing handles.

### Reuse and recover configuration

Scene presets show slots and a composition preview before loading geometry into the draft. Excluded cameras retain their previous settings. Tools can copy selected appearance categories or geometry between cameras and scenes; geometry and live background are excluded by default. Scene macros apply immediately when run and continue to exclude the live background.

Backups always export saved world configuration, not the local draft. Import accepts legacy, v1 and v2 files, requires explicit mapping or exclusion of unmatched scene/user IDs, and reviews changes before writing. Merge preserves omitted fields; selective replacement replaces included camera configurations; full restoration requires a complete backup and may delete existing settings. Download a backup before replacing anything. If a write fails, recovery avoids overwriting detected external changes and reports whether restoration was incomplete.

The new editor is available as an opt-in beta. In-Foundry visual and multi-client verification remains required before a stable release; see [the acceptance checklist](docs/UX_ACCEPTANCE.md).

## Live camera background

- A GM configures the source and fit in the editor's Scene section; Apply synchronizes the choice to every client.
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
- Open Tools → Diagnostics to generate a structured report, including the local editor draft and conflicts, for the selected player without using the browser console.
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
