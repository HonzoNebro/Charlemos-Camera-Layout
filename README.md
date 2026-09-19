# Charlemos Camera Layout

> **3.3.0-beta.4 — testing only.** This branch is an opt-in prerelease, not the stable distribution. Use a separate Foundry data directory and a copy of your world. It uses the same module ID and therefore replaces stable Charlemos in that installation.

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

**Frame blending** controls how the complete frame blends with the content behind it, independently of the tint layer. **Normal** preserves artwork colors and alpha; **Screen** lightens the backdrop; **Soft light** blends light and shadow. **Automatic (legacy)** retains the previous path-based behavior. Selection changes the local draft with one-step Undo, without changing the video, asset or frame visibility. Apply shares the result. Existing configurations remain automatic unless explicitly changed. This does not add transparency to opaque artwork; use an alpha-enabled asset for a reliable silhouette.

In **Cameras → Frame / overlay image**, quick frame presets load into the draft and turn on local preview: **Inside the camera** (no extension), **Outer frame** (10% on each side), and **Lower nameplate space** (25% below). The solid hatched rectangle represents the camera; the dashed outline represents the frame bounds, not the asset's alpha silhouette. Presets show the whole asset (`contain`), center it and reset frame offset, scale and rotation. They preserve the asset, visibility, opacity, tint and all camera geometry/effects. Disabled frames remain disabled. Choose a suitable transparent asset, enable it and fine-tune its opening; presets do not generate artwork or automatically match that opening to the video. Each preset is one Undo step. Apply shares the result; discard leaves the saved composition unchanged.

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

## Saved compositions and support

### Viewer-role variants (beta.4)

In **Cameras → Edit camera settings for**, select **Shared base**, **GM view** or **Player view**. The role belongs to the viewer, not the camera owner. Fields changed in a variant override the base; all omitted fields continue inheriting it. The same position, effects, frame, name and visual editor controls edit the selected scope. Positioning control can independently inherit the base or use Foundry/Charlemos for that role, with the usual dock restrictions.

Use **Inherit this section/camera/entire role from base** to remove overrides in the draft. Undo/redo covers both base and role edits. Select **Local preview audience** to inspect the base, GM or player result on your client; turning preview off restores the latest saved result for your actual role. Starting the visual editor aligns preview with the editing audience. Changing the audience stops the current visual editor so later gestures cannot target the wrong scope. Apply publishes all pending scopes together; Cancel discards them. The camera background and composition enabled state remain shared.

Scene distribution presets and selective copying act on the base. Duplication and templates also carry explicitly included role variants while retaining unspecified destination variants and destination-only users. New macros can carry role variants; older macros without them continue updating the base and preserve existing variants. Passing an explicit empty `roleVariants` object when applying a full composition clears them. JSON v2 imports and exports retain sparse overrides and map role-only users and relative targets explicitly. Old backups/macros/configurations remain usable without any automatic migration.

Role variants are presentation settings, not access control. Shared world configuration can contain both audiences' values; no feed, audio or private information is secured by styling a role differently. Real GM/player and two-GM Foundry acceptance is still pending.

### Composition library (beta.3)

**Tools → Composition library** stores reusable templates independently of scenes in a world-shared setting. Only a GM can create, replace, rename or delete them. Choose **Saved value** or **Draft value**, enter a name and confirm the library write. This saves the template immediately but does not apply the composition to a scene; closing or cancelling the scene editor does not undo library operations.

Select a template, review its camera IDs and explicitly assign or exclude them, then **Load into scene draft**. Existing IDs are proposed only when that same user still exists; names are never matched. Relative-camera targets must also have valid destinations. Loading replaces the included camera layouts, keeps other destination cameras and scene properties, switches positioning control and leaves the live background unchanged. It is one Undo step with local preview; **Apply** publishes the destination scene. Templates are snapshots, not live links: subsequent template changes or deletion never update scenes automatically. Custom CSS, inactive native-mode geometry, expanded frames and frame blending remain intact.

JSON v2 backups include the optional `profileLibrary` block. Legacy/unversioned/v1/v2 backups without it remain valid and never clear the library. Merge/replace imports update whole included template IDs, not individual template fields; other templates remain. A confirmed full restore replaces the library only if the file includes that block. Imported templates keep their source camera IDs until you assign them at load time. Use a library-aware version to restore templates; older versions may ignore this optional block. Backups always contain persisted world settings, not the scene's pending draft.

If another GM changes a selected template, refresh it and review again before replacing, deleting or loading it. Library writes use the same conflict checks, verification and recovery mechanism as configuration writes, not a distributed transaction. Keep a backup before deleting templates or importing replacements.

In **Tools → Saved scene compositions**, inspect camera counts, positioning control, missing users and scene IDs. Open an existing composition or duplicate it into another scene's draft. Duplication reviews added/replaced user IDs, preserves destination-only users and excludes the camera background. View the destination scene before Apply. Use selective copying to omit categories or unavailable users. Macro names now suggest the scene and saved/draft state, with a unique suffix; existing macros keep their immediate-apply behavior.

**Tools → Download diagnostic JSON** captures the current local report in one click. You can also inspect and download a report from the Diagnostic window. Review names, IDs, file paths and configuration before sharing; no audio or camera frames are included. See the troubleshooting guides: [English](docs/TROUBLESHOOTING.md), [Español](docs/TROUBLESHOOTING.es.md), [Galego](docs/TROUBLESHOOTING.gl.md).

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

## Guided crops and frame alignment (beta.4)

In **Cameras → Video and effects**, selecting a crop preset explicitly replaces the current clip path. Compatible circles, ellipses and insets expose their dimensions and center/corner parameters with an illustrative preview. Other CSS remains editable in Advanced and is not reconstructed by basic controls. Opposite inset percentages cannot exceed 100% in the guided controls.

In **Cameras → Frame / overlay**, use the six rectangle-alignment actions to match an edge or center of the transformed frame to the camera. They account for exterior bounds, scale and rotation; only the selected axis offset changes. Percentage offsets remain relative to the expanded frame rectangle, not the camera. Simple px/%/vw/vh units are retained. Custom offset expressions require explicit conversion, and a visible, measurable camera is necessary. Transparent pixels belong to the rectangle; this does not detect the painted silhouette or change image alignment inside the frame. Neither action changes the video size.

Both tools edit the selected base/GM/player scope, support undo and remain local until Apply. Real Foundry visual acceptance is still required.

## Development verification

Run `npm run test:quality` for metadata, translation, syntax and unit/regression checks. The same non-publishing Quality workflow runs for stable and preview changes on Node 20/22. Snapshot fixtures record expected configuration/style output; they are not browser screenshots and must not be blindly regenerated to accommodate regressions. Use [the Foundry checklist](docs/UX_ACCEPTANCE.md) for real rendering, accessibility, multi-client and GPU validation.

The [pseudo-tile evaluation](docs/LIVE_CAMERA_TILES_EVALUATION.md) is complete. No positioned live-camera tile feature is included in this release.
