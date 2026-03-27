# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-03-27

### Added
- Explicit `layoutMode` contract (`absolute` vs `relative`) for camera geometry in module-owned scenes.
- Scene-wide relative layout validation with user-facing errors and warnings for missing targets, self-targets, cycles, offline targets, and non-visible targets.
- Reusable scene macros that apply the exported profile to whichever scene is active when the macro is executed.
- Dedicated unit coverage for window instance scoping and relative-layout validation rules.

### Changed
- Relative camera chains now resolve at scene level before render, allowing stable `A -> B -> C` dependency resolution.
- Scene camera profiles can be reused across scenes without being tied to the source scene id.
- All dedicated config windows now use per-instance scoped DOM ids, avoiding cross-window interference when multiple editors are open.
- Release metadata restored to stable production identity in manifest:
  - module id: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.5.0`

### Fixed
- Restored scene macro export from the config hub after the scene-control refactor.
- Prevented docked cameras from keeping module-owned geometry while inside the Foundry dock.
- Removed orphaned preset/snap/resize flows and stale i18n keys left over from earlier layout tooling.

### Quality
- Simplified config/runtime code by removing dead preset tooling and stale release-branch identifiers.
- Validated release branch with `npm test` and JSON parsing for all locale files.

## [1.4.0] - 2026-03-27

### Added
- Scene-level camera control mode with explicit `native` vs `module` ownership for camera geometry.
- Dedicated layout geometry controls for module-owned scenes, including persisted `position`, `top`, `left`, `width`, and `height`.
- Relative camera positioning with edge/center alignment options (`above`, `below`, `left`, `right` variants).
- Scene layout generator with dynamic grid sizing, narrative presets, responsive/fixed units, and selectable user order.
- Offline-user editing support so camera layouts can be prepared before a player reconnects.

### Changed
- Native mode now preserves Foundry camera movement and resize behavior without module interference.
- Module mode now blocks native drag/resize affordances and reapplies geometry immediately when scene control mode changes.
- Scene layout presets now size cells from live video feed dimensions when available, with safe fallback sizing when no feed exists.
- Release metadata restored to stable production identity in manifest:
  - module id: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.4.0`

### Fixed
- Resize handle visibility now follows ownership rules correctly: hover-only in native mode, always hidden in module mode.
- Scene profile macros now apply immediately instead of only loading draft data into the editor.
- Locale JSON files restored to valid structure after phase-8 testing changes.

### Quality
- Added unit coverage for scene control mode, relative positioning, scene layout generation, and offline-user selection.

## [1.3.0] - 2026-03-26

### Added
- Dedicated configuration hub with separate windows for Layout, Effects, Overlay, and Name Style.
- Shared config helpers to keep per-player editing consistent across all dedicated windows.
- Player-reset action with confirmation to clear both global and current-scene camera overrides for the selected user.

### Changed
- Main camera config window now focuses on player selection, section summaries, and entry points to dedicated editors.
- Name Style configuration now follows the same selected-player workflow as the other dedicated windows.
- Scene macro export is labeled explicitly as a scene-level action.
- Release metadata restored to stable production identity in manifest:
  - module id: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.3.0`

### Fixed
- Removed misleading scene-wide reset action from the player-focused config hub.
- Prevented branch-testing module identifiers from leaking into the stable release build.

### Quality
- Updated localization strings (`en`, `es`, `gl`) for the new config hub workflow.
- Added unit coverage for removing a single player layout without affecting other players.

## [1.2.0] - 2026-03-26

### Added
- New overlay frame fitting controls in camera config:
  - **Overlay Fit Mode**: `auto`, `cover`, `contain`, `fill`
  - **Overlay Anchor**: center, edges and corners
- Updated localization strings (`en`, `es`, `gl`) for the new overlay controls.
- New and expanded unit tests for overlay fit/anchor normalization and renderer behavior.

### Changed
- Overlay rendering now applies explicit `background-size` and `background-position` from configuration.
- Legacy frame fallback behavior is preserved in `auto` mode for backward compatibility.
- Release metadata restored to stable production identity in manifest:
  - module `id`: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.2.0`

### Fixed
- Avoided unexpected cropping with non-4:3 frame overlays by allowing `contain` fit mode.
- Prevented frame fallback logic from overriding explicit fit/anchor choices.

### Quality
- `npm test` passing with updated coverage for:
  - `tests/unit/camera-config-model.test.js`
  - `tests/unit/camera-layout-style.test.js`
  - `tests/unit/live-camera-renderer.test.js`

## [1.1.0] - 2026-03-26

### Added
- Dedicated **Name Style Configuration** window, accessible from the camera layout config, to reduce form overload.
- Nameplate style controls for:
  - text alignment (`left`, `center`, `right`, `justify`)
  - constrained font weight presets (`400`, `500`, `600`, `700`)
  - font style (`normal`, `italic`)
- Dynamic font-family options sourced from Foundry server-available fonts, with fallback behavior.
- New rendering logic for nameplate placement and style normalization in the live camera renderer.
- Unit tests covering new name style normalization and config model behavior.

### Changed
- Nameplate visual style updated to better match native Foundry framing (blur/plate feel and camera-edge fit for top/bottom placement).
- Camera config model and app were refactored to support dedicated name config flow and stricter value normalization.
- Runtime metadata restored from branch-testing identity to stable production identity (`charlemos-camera-layout`).
- Release metadata updated for stable distribution:
  - module version: `1.1.0`
  - download URL points to tag archive `v1.1.0`

### Fixed
- Reduced overlap issues between custom nameplate rendering and native camera controls.
- Improved behavior when native and custom naming modes coexist, including native-name fallback support.

### Quality
- Updated translations (`en`, `es`, `gl`) for new name configuration capabilities.
- Added/updated tests in:
  - `tests/unit/camera-config-model.test.js`
  - `tests/unit/camera-layout-style.test.js`

## [1.0.0] - 2026-03-20

### Added
- Initial stable release of Charlemos Camera Layout.
- Per-player camera styling, scene profile support, overlay controls, and export/import tooling.
